/**
 * The lyrics panel. Owns all of its DOM; the rest of the extension talks to
 * it through the methods below and the handlers passed to the constructor.
 */

import type { LyricsResult } from "../providers";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const REPOSITORY_URL = "https://github.com/Firefox0/Youtube-Lyrics";
const BODY_ID = "yl-body";

/** Material Design icon paths (Apache License 2.0). */
const ICON_PATHS = {
  expandMore: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  expandLess: "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
  search:
    "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  arrowDown: "M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z",
  arrowUp: "M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z",
} as const;

type IconName = keyof typeof ICON_PATHS;

export interface PanelHandlers {
  readonly onToggle: () => void;
  readonly onMove: () => void;
  /** Called with the trimmed search field value (possibly empty). */
  readonly onSearch: (query: string) => void;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function setIcon(button: HTMLButtonElement, icon: IconName): void {
  button.querySelector("path")?.setAttribute("d", ICON_PATHS[icon]);
}

function setLabel(button: HTMLButtonElement, label: string): void {
  button.setAttribute("aria-label", label);
  button.title = label;
}

function createIconButton(
  icon: IconName,
  label: string,
  type: "button" | "submit" = "button",
): HTMLButtonElement {
  const button = createElement("button", "yl-button");
  button.type = type;

  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.append(document.createElementNS(SVG_NAMESPACE, "path"));
  button.append(svg);

  setIcon(button, icon);
  setLabel(button, label);
  return button;
}

/** Only HTTPS links are rendered as clickable. */
function toSafeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export class LyricsPanel {
  private readonly root = createElement("section", "yl-panel");
  private readonly toggleButton = createIconButton("expandMore", "Show lyrics");
  private readonly controls = createElement("form", "yl-controls");
  private readonly input = createElement("input", "yl-input");
  private readonly searchButton = createIconButton("search", "Search for lyrics", "submit");
  private readonly moveButton = createIconButton("arrowDown", "Move lyrics below the description");
  private readonly body = createElement("div", "yl-body");
  private readonly spinner = createElement("div", "yl-spinner");
  private readonly source = createElement("a", "yl-source");
  private readonly status = createElement("p", "yl-status");
  private readonly lyrics = createElement("p", "yl-lyrics");

  private descriptionHost: HTMLDivElement | null = null;
  private sidebarHost: HTMLDivElement | null = null;
  private insideDescription = false;

  constructor(handlers: PanelHandlers) {
    this.input.type = "text";
    this.input.placeholder = "Search";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.setAttribute("aria-label", "Search for lyrics");

    this.controls.setAttribute("role", "search");
    this.body.id = BODY_ID;
    this.toggleButton.setAttribute("aria-controls", BODY_ID);

    this.source.target = "_blank";
    this.source.rel = "noopener noreferrer";
    this.source.hidden = true;

    this.spinner.setAttribute("role", "status");
    this.spinner.setAttribute("aria-label", "Loading lyrics");
    this.spinner.hidden = true;
    // Only short messages are announced; the lyrics themselves are not a live region.
    this.status.setAttribute("role", "status");

    this.controls.append(this.input, this.searchButton, this.moveButton);
    this.body.append(this.spinner, this.source, this.status, this.lyrics);
    this.root.append(this.toggleButton, this.controls, this.body);

    this.toggleButton.addEventListener("click", () => handlers.onToggle());
    this.moveButton.addEventListener("click", () => handlers.onMove());
    this.controls.addEventListener("submit", (event) => {
      event.preventDefault();
      handlers.onSearch(this.input.value.trim());
    });

    this.setOpen(false);
  }

  /** `true` while the panel is attached to a live page. */
  get isMounted(): boolean {
    return this.descriptionHost?.isConnected === true && this.sidebarHost?.isConnected === true;
  }

  /** Attaches the panel to YouTube's layout. Safe to call again after a re-render. */
  mount(description: HTMLElement, secondary: HTMLElement): void {
    this.removeHosts();

    this.descriptionHost = createElement("div", "yl-host");
    this.sidebarHost = createElement("div", "yl-host yl-host--sidebar");
    description.insertAdjacentElement("afterend", this.descriptionHost);
    secondary.prepend(this.sidebarHost);

    this.setPlacement(this.insideDescription);
  }

  setOpen(open: boolean): void {
    this.controls.hidden = !open;
    this.body.hidden = !open;
    setIcon(this.toggleButton, open ? "expandLess" : "expandMore");
    setLabel(this.toggleButton, open ? "Hide lyrics" : "Show lyrics");
    this.toggleButton.setAttribute("aria-expanded", String(open));
  }

  setPlacement(insideDescription: boolean, scrollIntoView = false): void {
    this.insideDescription = insideDescription;
    setIcon(this.moveButton, insideDescription ? "arrowUp" : "arrowDown");
    setLabel(
      this.moveButton,
      insideDescription ? "Move lyrics to the sidebar" : "Move lyrics below the description",
    );

    if (this.sidebarHost) this.sidebarHost.hidden = insideDescription;

    const host = insideDescription ? this.descriptionHost : this.sidebarHost;
    if (!host) return;

    host.append(this.root);
    if (scrollIntoView) {
      host.scrollIntoView({ behavior: "smooth", block: insideDescription ? "start" : "end" });
    }
  }

  setDark(dark: boolean): void {
    this.root.dataset["theme"] = dark ? "dark" : "light";
  }

  showLoading(): void {
    this.source.hidden = true;
    this.status.textContent = "";
    this.lyrics.textContent = "";
    this.spinner.hidden = false;
  }

  showResult(result: LyricsResult): void {
    this.spinner.hidden = true;
    this.setSource(result.title, toSafeUrl(result.url));
    this.status.textContent = "";
    this.lyrics.textContent = result.lyrics;
  }

  showMessage(text: string): void {
    this.spinner.hidden = true;
    this.setSource("Report an issue", REPOSITORY_URL);
    this.lyrics.textContent = "";
    this.status.textContent = text;
  }

  private setSource(label: string, href: string | null): void {
    this.source.textContent = label;
    if (href) {
      this.source.href = href;
    } else {
      this.source.removeAttribute("href");
    }
    this.source.hidden = false;
  }

  private removeHosts(): void {
    this.descriptionHost?.remove();
    this.sidebarHost?.remove();
    this.descriptionHost = null;
    this.sidebarHost = null;
  }
}
