import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("webextension-polyfill", () => ({ default: { runtime: { sendMessage: vi.fn() } } }));

import type { LyricsResult } from "../../src/shared/types";
import { clearCache, findLyrics } from "../../src/providers/index";
import type { LyricsProvider } from "../../src/providers/provider";

const lyrics: LyricsResult = {
  title: "Song",
  url: "https://genius.com/song",
  lyrics: "la la la la la la la la",
};

const provider = (getLyrics: LyricsProvider["getLyrics"]): LyricsProvider => ({
  name: "test",
  getLyrics: vi.fn(getLyrics),
});

describe("findLyrics", () => {
  beforeEach(() => {
    clearCache();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("returns the first provider's result", async () => {
    const first = provider(() => Promise.resolve(lyrics));
    const second = provider(() => Promise.resolve(lyrics));

    expect(await findLyrics("a song", [first, second])).toEqual(lyrics);
    expect(second.getLyrics).not.toHaveBeenCalled();
  });

  it("falls back when a provider finds nothing or throws", async () => {
    const empty = provider(() => Promise.resolve(null));
    const broken = provider(() => Promise.reject(new Error("boom")));
    const working = provider(() => Promise.resolve(lyrics));

    expect(await findLyrics("a song", [empty, broken, working])).toEqual(lyrics);
  });

  it("returns null when every provider fails", async () => {
    expect(await findLyrics("a song", [provider(() => Promise.resolve(null))])).toBeNull();
  });

  it("rejects implausibly short lyrics", async () => {
    const short = provider(() => Promise.resolve({ ...lyrics, lyrics: "hi" }));
    expect(await findLyrics("a song", [short])).toBeNull();
  });

  it("normalises the query and caches successful results", async () => {
    const source = provider(() => Promise.resolve(lyrics));

    await findLyrics("  A Song ", [source]);
    await findLyrics("a song", [source]);

    expect(source.getLyrics).toHaveBeenCalledTimes(1);
    expect(source.getLyrics).toHaveBeenCalledWith("a song");
  });

  it("does not cache failures", async () => {
    const source = provider(() => Promise.resolve(null));

    await findLyrics("a song", [source]);
    await findLyrics("a song", [source]);

    expect(source.getLyrics).toHaveBeenCalledTimes(2);
  });

  it("returns null for a blank query without querying providers", async () => {
    const source = provider(() => Promise.resolve(lyrics));

    expect(await findLyrics("   ", [source])).toBeNull();
    expect(source.getLyrics).not.toHaveBeenCalled();
  });
});
