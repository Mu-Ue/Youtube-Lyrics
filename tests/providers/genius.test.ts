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

import { genius } from "../../src/providers/genius";

const QUERY = "michael jackson beat it";
const SEARCH_URL = "https://genius.com/api/search/song?per_page=5&q=michael+jackson+beat+it";
const SONG_URL = "https://genius.com/Michael-jackson-beat-it-lyrics";

const searchResponse = JSON.stringify({
  response: { sections: [{ type: "song", hits: [{ type: "song", result: { url: SONG_URL } }] }] },
});

function serve(pages: Record<string, string>): ReturnType<typeof createFakeNetwork> {
  const fake = createFakeNetwork(pages);
  network.text.mockImplementation(fake.text);
  network.json.mockImplementation(fake.json);
  return fake;
}

describe("genius provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when the search has no song hit", async () => {
    serve({ [SEARCH_URL]: JSON.stringify({ response: { sections: [] } }) });
    expect(await genius.getLyrics(QUERY)).toBeNull();
  });

  it("returns null when the search request fails", async () => {
    serve({});
    expect(await genius.getLyrics(QUERY)).toBeNull();
  });

  it("returns null when the page has no lyrics containers", async () => {
    serve({
      [SEARCH_URL]: searchResponse,
      [SONG_URL]:
        '<html><head><meta property="og:title" content="Beat It Lyrics | Genius Lyrics"></head>' +
        "<body><p>Lyrics for this song have yet to be released.</p></body></html>",
    });
    expect(await genius.getLyrics(QUERY)).toBeNull();
  });
});
