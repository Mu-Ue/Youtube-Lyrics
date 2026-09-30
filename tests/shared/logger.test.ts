import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../src/shared/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefixes warnings and passes the error along", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cause = new Error("boom");

    logger.warn("Something failed", cause);

    expect(warn).toHaveBeenCalledWith("[YouTube Lyrics] Something failed", cause);
  });

  it("omits the error argument when there is none", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error("Fatal");

    expect(error).toHaveBeenCalledWith("[YouTube Lyrics] Fatal");
  });
});
