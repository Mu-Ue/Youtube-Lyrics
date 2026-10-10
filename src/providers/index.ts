/**
 * Lyrics lookup across all providers, in priority order, with a small
 * in-memory LRU cache so repeated lookups do not hit the network.
 */

import { logger } from "../shared/util";
import { genius } from "./genius";
import { letsSingIt } from "./letssingit";
import type { LyricsProvider, LyricsResult } from "./provider";
import { songLyrics } from "./songlyrics";

export type { LyricsResult } from "./provider";

const PROVIDERS: readonly LyricsProvider[] = [genius, letsSingIt, songLyrics];
const MIN_LYRICS_LENGTH = 15;
const CACHE_LIMIT = 20;

const cache = new Map<string, LyricsResult>();

function remember(key: string, result: LyricsResult): void {
  // Re-inserting moves the key to the most recently used position.
  cache.delete(key);
  cache.set(key, result);

  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Empties the lookup cache. Intended for tests. */
export function clearCache(): void {
  cache.clear();
}

export interface FindOptions {
  readonly providers?: readonly LyricsProvider[];
  /** Stops trying further providers once aborted; the result is then `null`. */
  readonly signal?: AbortSignal;
}

/**
 * Returns the first usable result from the providers, or `null`.
 * Never rejects: a failing provider is skipped.
 */
export async function findLyrics(
  query: string,
  { providers = PROVIDERS, signal }: FindOptions = {},
): Promise<LyricsResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }

  for (const provider of providers) {
    if (signal?.aborted) return null;

    try {
      const result = await provider.getLyrics(key);
      if (result && result.lyrics.trim().length >= MIN_LYRICS_LENGTH) {
        remember(key, result);
        return result;
      }
    } catch (error) {
      logger.warn(`${provider.name} failed`, error);
    }
  }
  return null;
}
