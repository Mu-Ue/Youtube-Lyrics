import { describe, expect, it } from "vitest";

import { isFetchRequest } from "../../src/shared/types";

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
