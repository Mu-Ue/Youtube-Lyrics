/**
 * Live canary tests: each provider runs its full flow (search, then song page)
 * against the real site and must return exactly the expected result. They fail
 * when a site changes its HTML, its search, or its lyrics.
 *
 * Not part of `npm test` or CI: real sites can be slow, rate-limit, or block
 * automated requests. Run on demand with `npm run test:live`.
 *
 * Requests go through the extension's own background fetcher, so they use the
 * same allow-list, headers and limits as the shipped extension.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/messaging", async () => {
  const { fetchResource } = await import("../../src/background/fetcher");

  return {
    fetchText: async (url: string): Promise<string | null> => {
      const response = await fetchResource(url, "text");
      return response.ok && typeof response.data === "string" ? response.data : null;
    },
    fetchJson: async (url: string): Promise<unknown> => {
      const response = await fetchResource(url, "json");
      return response.ok ? response.data : null;
    },
  };
});

import { genius } from "../../src/providers/genius";
import { letsSingIt } from "../../src/providers/letssingit";
import type { LyricsProvider } from "../../src/providers/provider";
import { songLyrics } from "../../src/providers/songlyrics";

const QUERY = "michael jackson beat it";

interface LiveCase {
  readonly provider: LyricsProvider;
  /** Domain the returned URL must belong to (the hostname may be a subdomain). */
  readonly domain: string;
  /** What the provider should return as the title. Fill in; the test is skipped while empty. */
  readonly title: string;
  /**
   * The exact plain-text lyrics the provider should return (no markdown, no
   * URLs): paste them between the backticks. Skipped while empty.
   */
  readonly lyrics: string;
}

const normalise = (text: string): string => text.replace(/\r\n?/g, "\n").trim();

const CASES: readonly LiveCase[] = [
  {
    provider: genius,
    domain: "genius.com",
    title: "",
    lyrics: normalise(String.raw``),
  },
  {
    provider: letsSingIt,
    domain: "letssingit.com",
    title: "",
    lyrics: normalise(String.raw``),
  },
  {
    provider: songLyrics,
    domain: "songlyrics.com",
    title: "",
    lyrics: normalise(String.raw``),
  },
];

describe.each(CASES)("live: $provider.name", ({ provider, domain, title, lyrics }) => {
  it.skipIf(title === "" || lyrics === "")(
    "returns exactly the expected title and lyrics",
    async () => {
      const result = await provider.getLyrics(QUERY);

      expect(result).not.toBeNull();
      expect(new URL(result?.url ?? "").hostname.endsWith(domain)).toBe(true);
      expect(result?.title).toBe(title);
      expect(result?.lyrics).toBe(lyrics);
    },
  );
});
