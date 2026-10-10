import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LyricsProvider, LyricsResult } from "../../src/providers/provider";
import { clearCache, findLyrics } from "../../src/providers/index";

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

    expect(await findLyrics("a song", { providers: [first, second] })).toEqual(lyrics);
    expect(second.getLyrics).not.toHaveBeenCalled();
  });

  it("falls back when a provider finds nothing or throws", async () => {
    const empty = provider(() => Promise.resolve(null));
    const broken = provider(() => Promise.reject(new Error("boom")));
    const working = provider(() => Promise.resolve(lyrics));

    expect(await findLyrics("a song", { providers: [empty, broken, working] })).toEqual(lyrics);
  });

  it("returns null when every provider fails", async () => {
    expect(
      await findLyrics("a song", { providers: [provider(() => Promise.resolve(null))] }),
    ).toBeNull();
  });

  it("rejects implausibly short lyrics", async () => {
    const short = provider(() => Promise.resolve({ ...lyrics, lyrics: "hi" }));
    expect(await findLyrics("a song", { providers: [short] })).toBeNull();
  });

  it("normalises the query and caches successful results", async () => {
    const source = provider(() => Promise.resolve(lyrics));

    await findLyrics("  A Song ", { providers: [source] });
    await findLyrics("a song", { providers: [source] });

    expect(source.getLyrics).toHaveBeenCalledTimes(1);
    expect(source.getLyrics).toHaveBeenCalledWith("a song");
  });

  it("does not cache failures", async () => {
    const source = provider(() => Promise.resolve(null));

    await findLyrics("a song", { providers: [source] });
    await findLyrics("a song", { providers: [source] });

    expect(source.getLyrics).toHaveBeenCalledTimes(2);
  });

  it("returns null for a blank query without querying providers", async () => {
    const source = provider(() => Promise.resolve(lyrics));

    expect(await findLyrics("   ", { providers: [source] })).toBeNull();
    expect(source.getLyrics).not.toHaveBeenCalled();
  });

  it("stops trying further providers once aborted", async () => {
    const controller = new AbortController();
    const first = provider(() => {
      controller.abort();
      return Promise.resolve(null);
    });
    const second = provider(() => Promise.resolve(lyrics));

    const result = await findLyrics("a song", {
      providers: [first, second],
      signal: controller.signal,
    });

    expect(result).toBeNull();
    expect(second.getLyrics).not.toHaveBeenCalled();
  });
});
