import { fetchJson } from "../shared/messaging";
import { isRecord } from "../shared/util";
import { buildUrl, elementToText, fetchDocument } from "./html";
import type { LyricsProvider, LyricsResult } from "./provider";

const SEARCH_ENDPOINT = "https://genius.com/api/search/song";
const LYRICS_CONTAINER = '[data-lyrics-container="true"]';
const EXCLUDED_ELEMENTS = '[data-exclude-from-selection="true"]';
const TITLE_SUFFIX = /\s*\|\s*Genius Lyrics$/i;

/** Returns the URL of the first song hit in a Genius search response. */
function findSongUrl(json: unknown): string | null {
  const sections =
    isRecord(json) && isRecord(json["response"]) ? json["response"]["sections"] : null;
  if (!Array.isArray(sections)) return null;

  for (const section of sections) {
    const hits = isRecord(section) ? section["hits"] : null;
    if (!Array.isArray(hits)) continue;

    for (const hit of hits) {
      if (!isRecord(hit) || hit["type"] !== "song" || !isRecord(hit["result"])) continue;

      const url = hit["result"]["url"];
      if (typeof url === "string") return url;
    }
  }
  return null;
}

function extractTitle(doc: Document): string | null {
  const content = doc.querySelector("meta[property='og:title']")?.getAttribute("content");
  const title = content?.replace(TITLE_SUFFIX, "").trim();
  return title ? title : null;
}

/**
 * Genius renders each lyric section in its own container, with `<br>` line
 * breaks and non-lyric annotations flagged as excluded from selection.
 */
function extractLyrics(doc: Document): string | null {
  const blocks: string[] = [];

  for (const container of doc.querySelectorAll(LYRICS_CONTAINER)) {
    const text = elementToText(container, EXCLUDED_ELEMENTS);
    if (text) blocks.push(text);
  }
  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

export const genius: LyricsProvider = {
  name: "Genius",

  async getLyrics(query: string): Promise<LyricsResult | null> {
    const searchUrl = buildUrl(SEARCH_ENDPOINT, { per_page: "5", q: query });
    const url = findSongUrl(await fetchJson(searchUrl));
    if (!url) return null;

    const doc = await fetchDocument(url);
    if (!doc) return null;

    const title = extractTitle(doc);
    const lyrics = extractLyrics(doc);
    return title && lyrics ? { title, url, lyrics } : null;
  },
};
