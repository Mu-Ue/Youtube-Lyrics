import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJson, fetchText, isFetchRequest } from "../../src/shared/messaging";

describe("isFetchRequest", () => {
  it.each(["json", "text"])("accepts a well-formed %s request", (kind) => {
    expect(isFetchRequest({ type: "fetch", kind, url: "https://genius.com/" })).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "fetch"],
    ["an array", []],
    ["an empty object", {}],
    ["a wrong type", { type: "other", kind: "text", url: "https://genius.com/" }],
    ["an unknown kind", { type: "fetch", kind: "blob", url: "https://genius.com/" }],
    ["a missing url", { type: "fetch", kind: "text" }],
    ["a non-string url", { type: "fetch", kind: "text", url: 42 }],
  ])("rejects %s", (_description, value) => {
    expect(isFetchRequest(value)).toBe(false);
  });
});

describe("messaging client", () => {
  const reply = (implementation: () => Promise<unknown>): ReturnType<typeof vi.fn> => {
    const sendMessage = vi.fn(implementation);
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    return sendMessage;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a typed request and returns the text body", async () => {
    const sendMessage = reply(() => Promise.resolve({ ok: true, data: "<p>hi</p>" }));

    expect(await fetchText("https://genius.com/song")).toBe("<p>hi</p>");
    expect(sendMessage).toHaveBeenCalledWith({
      type: "fetch",
      kind: "text",
      url: "https://genius.com/song",
    });
  });

  it("returns parsed JSON data", async () => {
    reply(() => Promise.resolve({ ok: true, data: { a: 1 } }));
    expect(await fetchJson("https://genius.com/api")).toEqual({ a: 1 });
  });

  it.each([
    ["an error reply", () => Promise.resolve({ ok: false, error: "network" })],
    ["a malformed reply", () => Promise.resolve("garbage")],
    ["a non-string text body", () => Promise.resolve({ ok: true, data: 42 })],
    ["a disconnected extension", () => Promise.reject(new Error("context invalidated"))],
  ])("returns null for %s", async (_description, implementation) => {
    reply(implementation);
    expect(await fetchText("https://genius.com/song")).toBeNull();
  });
});
