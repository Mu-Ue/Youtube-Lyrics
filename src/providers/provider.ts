import type { LyricsResult } from "../shared/types";

/** A source of lyrics that can be queried with a free-text "artist song". */
export interface LyricsProvider {
  readonly name: string;
  getLyrics(query: string): Promise<LyricsResult | null>;
}
