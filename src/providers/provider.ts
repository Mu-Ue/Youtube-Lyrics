/** A successfully resolved set of lyrics. */
export interface LyricsResult {
  readonly title: string;
  readonly url: string;
  readonly lyrics: string;
}

/** A source of lyrics that can be queried with a free-text "artist song". */
export interface LyricsProvider {
  readonly name: string;
  getLyrics(query: string): Promise<LyricsResult | null>;
}
