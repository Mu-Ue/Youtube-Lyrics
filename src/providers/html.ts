/** Helpers shared by the HTML-scraping lyrics providers. */

import { fetchText } from "../shared/messaging";

const parser = new DOMParser();

/**
 * Downloads a page through the background worker and parses it into an inert
 * document. `DOMParser` never executes scripts or loads subresources.
 */
export async function fetchDocument(url: string): Promise<Document | null> {
  const html = await fetchText(url);
  return html === null ? null : parser.parseFromString(html, "text/html");
}

/** Builds a URL with properly encoded query parameters. */
export function buildUrl(base: string, params: Readonly<Record<string, string>>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** Resolves a possibly relative `href` against `base`; `null` if unusable. */
export function resolveUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;

  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Extracts readable text from an element of a parsed (detached) document.
 *
 * `innerText` is unreliable outside a rendered tree, so line breaks are
 * restored explicitly from `<br>` elements instead.
 */
export function elementToText(element: Element, excludeSelector?: string): string {
  const clone = element.cloneNode(true) as Element;

  clone.querySelectorAll("script, style").forEach((node) => node.remove());
  if (excludeSelector) clone.querySelectorAll(excludeSelector).forEach((node) => node.remove());
  for (const lineBreak of clone.querySelectorAll("br")) lineBreak.replaceWith("\n");

  return (clone.textContent ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
