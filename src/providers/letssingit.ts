import type { LyricsResult } from "../shared/types";
import { buildUrl, elementToText, fetchDocument, resolveUrl } from "./html";
import type { LyricsProvider } from "./provider";

const SEARCH_URL = "https://search.letssingit.com/";
const NO_LYRICS_PREFIX = "Unfortunately we don't have the lyrics";

export const letsSingIt: LyricsProvider = {
  name: "LetsSingIt",

  async getLyrics(query: string): Promise<LyricsResult | null> {
    const searchUrl = buildUrl(SEARCH_URL, { a: "search", s: query });
    const results = await fetchDocument(searchUrl);
    if (!results) return null;

    const href = results.querySelector(".high_profile[href]")?.getAttribute("href");
    const url = resolveUrl(href, searchUrl);
    if (!url) return null;

    const doc = await fetchDocument(url);
    if (!doc) return null;

    const title = doc.title.split(" Lyrics")[0]?.trim();
    const container = doc.getElementById("lyrics");
    if (!title || !container) return null;

    const lyrics = elementToText(container);
    if (!lyrics || lyrics.startsWith(NO_LYRICS_PREFIX)) return null;

    return { title, url, lyrics };
  },
};
