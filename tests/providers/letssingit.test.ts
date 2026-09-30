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

import { letsSingIt } from "../../src/providers/letssingit";

const QUERY = "michael jackson beat it";
const SEARCH_URL = "https://search.letssingit.com/?a=search&s=michael+jackson+beat+it";
const SONG_URL = "https://search.letssingit.com/lyrics/michael-jackson/beat-it.html";
const OTHER_URL = "https://search.letssingit.com/lyrics/michael-jackson/bad.html";

const searchPage =
  '<html><body><a class="high_profile" href="/lyrics/michael-jackson/beat-it.html">Beat It</a>' +
  '<a class="high_profile" href="/lyrics/michael-jackson/bad.html">Bad</a></body></html>';

function serve(pages: Record<string, string>): ReturnType<typeof createFakeNetwork> {
  const fake = createFakeNetwork(pages);
  network.text.mockImplementation(fake.text);
  return fake;
}

describe("letsSingIt provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("follows the first high-profile hit, not later ones", async () => {
    const fake = serve({
      [SEARCH_URL]: searchPage,
      [SONG_URL]:
        "<html><head><title>Beat It Lyrics - LetsSingIt</title></head>" +
        '<body><div id="lyrics">x</div></body></html>',
    });

    await letsSingIt.getLyrics(QUERY);

    expect(fake.requested).toEqual([SEARCH_URL, SONG_URL]);
    expect(fake.requested).not.toContain(OTHER_URL);
  });

  it("returns null when the search page has no hit", async () => {
    serve({ [SEARCH_URL]: "<html><body><p>No results</p></body></html>" });
    expect(await letsSingIt.getLyrics(QUERY)).toBeNull();
  });

  it("returns null when the search request fails", async () => {
    serve({});
    expect(await letsSingIt.getLyrics(QUERY)).toBeNull();
  });

  it("returns null for the site's 'no lyrics' placeholder page", async () => {
    serve({
      [SEARCH_URL]: searchPage,
      [SONG_URL]:
        "<html><head><title>Beat It Lyrics - LetsSingIt</title></head>" +
        '<body><div id="lyrics">Unfortunately we don\'t have the lyrics for this song yet.</div></body></html>',
    });
    expect(await letsSingIt.getLyrics(QUERY)).toBeNull();
  });
});
