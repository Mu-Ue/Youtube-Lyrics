import { beforeEach, describe, expect, it, vi } from "vitest";

import { LyricsPanel, type PanelHandlers } from "../../src/content/panel";

function createHandlers(): PanelHandlers {
  return { onToggle: vi.fn(), onMove: vi.fn(), onSearch: vi.fn() };
}

/** Mounts a panel into a minimal stand-in for YouTube's layout. */
function mountPanel(handlers = createHandlers()): LyricsPanel {
  const description = document.createElement("div");
  const secondary = document.createElement("div");
  document.body.append(description, secondary);

  const panel = new LyricsPanel(handlers);
  panel.mount(description, secondary);
  return panel;
}

const query = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
};

describe("LyricsPanel", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("renders lyrics as text, never as markup", () => {
    const panel = mountPanel();
    panel.showResult({
      title: "Song",
      url: "https://genius.com/song",
      lyrics: "<img src=x onerror=alert(1)>",
    });

    expect(document.querySelector("img")).toBeNull();
    expect(query(".yl-lyrics").textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("links to HTTPS sources only", () => {
    const panel = mountPanel();

    panel.showResult({ title: "Song", url: "https://genius.com/song", lyrics: "la" });
    expect(query<HTMLAnchorElement>(".yl-source").getAttribute("href")).toBe(
      "https://genius.com/song",
    );

    panel.showResult({ title: "Song", url: "javascript:alert(1)", lyrics: "la" });
    expect(query<HTMLAnchorElement>(".yl-source").hasAttribute("href")).toBe(false);
  });

  it("announces messages through a status region and clears stale lyrics", () => {
    const panel = mountPanel();
    panel.showResult({ title: "Song", url: "https://genius.com/song", lyrics: "la la" });

    panel.showMessage("No lyrics found");

    expect(query(".yl-status").textContent).toBe("No lyrics found");
    expect(query(".yl-status").getAttribute("role")).toBe("status");
    expect(query(".yl-lyrics").textContent).toBe("");
    expect(query(".yl-lyrics").hasAttribute("aria-live")).toBe(false);
  });

  it("exposes the search form as a landmark and links the toggle to the collapsible body", () => {
    mountPanel();
    const toggle = query<HTMLButtonElement>(".yl-button");

    expect(query(".yl-controls").getAttribute("role")).toBe("search");
    expect(query(".yl-body").id).toBe(toggle.getAttribute("aria-controls"));
  });

  it("opens external links safely", () => {
    mountPanel();
    const link = query<HTMLAnchorElement>(".yl-source");

    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("reflects the open state for assistive technology", () => {
    const panel = mountPanel();
    const toggle = query<HTMLButtonElement>(".yl-button");

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(query(".yl-body").hasAttribute("hidden")).toBe(true);

    panel.setOpen(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(query(".yl-body").hasAttribute("hidden")).toBe(false);
  });

  it("moves between the sidebar and the description", () => {
    const panel = mountPanel();
    const root = query(".yl-panel");

    expect(root.parentElement?.classList.contains("yl-host--sidebar")).toBe(true);

    panel.setPlacement(true);
    expect(root.parentElement?.classList.contains("yl-host--sidebar")).toBe(false);
  });

  it("reports mounted state and unmounts cleanly", () => {
    const panel = mountPanel();
    expect(panel.isMounted).toBe(true);

    panel.destroy();
    expect(panel.isMounted).toBe(false);
    expect(document.querySelector(".yl-panel")).toBeNull();
  });

  it("forwards clicks and trimmed searches to the handlers", () => {
    const handlers = createHandlers();
    mountPanel(handlers);

    query<HTMLButtonElement>(".yl-button").click();
    expect(handlers.onToggle).toHaveBeenCalledOnce();

    query<HTMLInputElement>(".yl-input").value = "  artist song  ";
    query<HTMLFormElement>(".yl-controls").dispatchEvent(new Event("submit", { cancelable: true }));
    expect(handlers.onSearch).toHaveBeenCalledWith("artist song");
  });
});
