import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeNetwork } from "../helpers/fixtures";

const network = vi.hoisted(() => ({
  text: vi.fn<(url: string) => Promise<string | null>>(),
  json: vi.fn<(url: string) => Promise<unknown>>(),
}));

vi.mock("../../src/shared/messaging", () => ({
  fetchText: network.text,
  fetchJson: network.json,
}));

import { songLyrics } from "../../src/providers/songlyrics";

const QUERY = "michael jackson beat it";
const SEARCH_URL =
  "https://www.songlyrics.com/index.php?section=search&searchW=michael+jackson+beat+it&submit=Search";
const SONG_URL = "https://www.songlyrics.com/michael-jackson/beat-it-lyrics/";

const searchPage =
  '<html><body><h2><a href="/wrong.html">Not a result</a></h2>' +
  '<h3><a href="/michael-jackson/beat-it-lyrics/">Beat It Lyrics</a></h3></body></html>';

function serve(pages: Record<string, string>): ReturnType<typeof createFakeNetwork> {
  const fake = createFakeNetwork(pages);
  network.text.mockImplementation(fake.text);
  return fake;
}

describe("songLyrics provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when the search page has no result heading", async () => {
    serve({ [SEARCH_URL]: "<html><body><h2><a href='/x'>x</a></h2></body></html>" });
    expect(await songLyrics.getLyrics(QUERY)).toBeNull();
  });

  it("returns null when the search request fails", async () => {
    serve({});
    expect(await songLyrics.getLyrics(QUERY)).toBeNull();
  });

  it("returns null when the lyrics container is empty", async () => {
    serve({
      [SEARCH_URL]: searchPage,
      [SONG_URL]:
        '<html><body><span itemprop="name">Beat It</span><div id="songLyricsDiv">   </div></body></html>',
    });
    expect(await songLyrics.getLyrics(QUERY)).toBeNull();
  });
});
