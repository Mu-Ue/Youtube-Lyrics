import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FetchResponse } from "../../src/shared/types";

interface Sender {
  id?: string;
  url?: string;
}
type Listener = (message: unknown, sender: Sender) => Promise<FetchResponse>;

const mocks = vi.hoisted(() => ({
  listener: undefined as Listener | undefined,
  fetchResource: vi.fn(),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      id: "extension-id",
      onMessage: {
        addListener: (listener: Listener) => {
          mocks.listener = listener;
        },
      },
    },
  },
}));
vi.mock("../../src/background/fetcher", () => ({ fetchResource: mocks.fetchResource }));

await import("../../src/background/index");

const trusted: Sender = { id: "extension-id", url: "https://www.youtube.com/watch?v=abc" };
const message = { type: "fetch", kind: "text", url: "https://genius.com/song" };

function handle(msg: unknown, sender: Sender): Promise<FetchResponse> {
  if (!mocks.listener) throw new Error("listener was not registered");
  return mocks.listener(msg, sender);
}

describe("background message handler", () => {
  beforeEach(() => {
    mocks.fetchResource.mockReset();
    mocks.fetchResource.mockResolvedValue({ ok: true, data: "body" });
  });

  it("forwards a valid request from the extension's YouTube content script", async () => {
    expect(await handle(message, trusted)).toEqual({ ok: true, data: "body" });
    expect(mocks.fetchResource).toHaveBeenCalledWith("https://genius.com/song", "text");
  });

  it.each([
    ["another extension", { ...trusted, id: "other-extension" }],
    ["a missing sender id", { url: trusted.url }],
    ["a missing sender url", { id: trusted.id }],
    ["a different site", { ...trusted, url: "https://evil.example/" }],
    ["a look-alike origin", { ...trusted, url: "https://www.youtube.com.evil.example/" }],
    ["plain http", { ...trusted, url: "http://www.youtube.com/" }],
    ["an unparsable url", { ...trusted, url: "not a url" }],
  ])("refuses %s", async (_description, sender) => {
    expect(await handle(message, sender)).toEqual({ ok: false, error: "forbidden" });
    expect(mocks.fetchResource).not.toHaveBeenCalled();
  });

  it("rejects malformed messages from a trusted sender", async () => {
    expect(await handle({ type: "fetch" }, trusted)).toEqual({ ok: false, error: "bad-request" });
    expect(mocks.fetchResource).not.toHaveBeenCalled();
  });
});
