import { describe, expect, it, vi } from "vitest";

vi.mock("webextension-polyfill", () => ({ default: { runtime: { sendMessage: vi.fn() } } }));

import { buildUrl, elementToText, resolveUrl } from "../../src/providers/html";

function parse(markup: string): Element {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  return doc.body.firstElementChild as Element;
}

describe("elementToText", () => {
  it("turns <br> into newlines", () => {
    expect(elementToText(parse("<div>one<br>two<br>three</div>"))).toBe("one\ntwo\nthree");
  });

  it("removes excluded elements", () => {
    const element = parse('<div>keep<span data-x="1">drop</span></div>');
    expect(elementToText(element, "[data-x]")).toBe("keep");
  });

  it("drops scripts and styles", () => {
    expect(elementToText(parse("<div>text<script>alert(1)</script><style>a{}</style></div>"))).toBe(
      "text",
    );
  });

  it("collapses runs of blank lines", () => {
    expect(elementToText(parse("<div>a<br><br><br><br>b</div>"))).toBe("a\n\nb");
  });

  it("does not modify the original element", () => {
    const element = parse("<div>a<br>b</div>");
    elementToText(element);
    expect(element.querySelectorAll("br")).toHaveLength(1);
  });
});

describe("buildUrl", () => {
  it("encodes query parameters", () => {
    const url = new URL(buildUrl("https://genius.com/api", { q: "a&b c" }));
    expect(url.searchParams.get("q")).toBe("a&b c");
    expect(url.search).not.toContain("a&b c");
  });
});

describe("resolveUrl", () => {
  it("resolves relative links", () => {
    expect(resolveUrl("/song/1", "https://www.songlyrics.com/search")).toBe(
      "https://www.songlyrics.com/song/1",
    );
  });

  it.each([null, undefined, ""])("returns null for %j", (href) => {
    expect(resolveUrl(href, "https://genius.com/")).toBeNull();
  });
});
