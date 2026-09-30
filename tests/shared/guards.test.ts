import { describe, expect, it } from "vitest";

import { isRecord } from "../../src/shared/guards";

describe("isRecord", () => {
  it.each([{}, { a: 1 }, []])("accepts %j", (value) => {
    expect(isRecord(value)).toBe(true);
  });

  it.each([null, undefined, "text", 42, true])("rejects %j", (value) => {
    expect(isRecord(value)).toBe(false);
  });
});
