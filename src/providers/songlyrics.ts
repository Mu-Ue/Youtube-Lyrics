import { buildUrl, elementToText, fetchDocument, resolveUrl } from "./html";
import type { LyricsProvider, LyricsResult } from "./provider";

const SEARCH_URL = "https://www.songlyrics.com/index.php";

export const songLyrics: LyricsProvider = {
  name: "SongLyrics",

  async getLyrics(query: string): Promise<LyricsResult | null> {
    const searchUrl = buildUrl(SEARCH_URL, { section: "search", searchW: query, submit: "Search" });
    const results = await fetchDocument(searchUrl);
    if (!results) return null;

    const href = results.querySelector("h3 a[href]")?.getAttribute("href");
    const url = resolveUrl(href, searchUrl);
    if (!url) return null;

    const doc = await fetchDocument(url);
    if (!doc) return null;

    const title = Array.from(doc.querySelectorAll("span[itemprop='name']"))
      .at(-1)
      ?.textContent?.trim();
    const container = doc.getElementById("songLyricsDiv");
    if (!title || !container) return null;

    const lyrics = elementToText(container);
    return lyrics ? { title, url, lyrics } : null;
  },
};
