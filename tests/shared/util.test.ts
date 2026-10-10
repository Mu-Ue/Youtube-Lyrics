import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debounce, isRecord, logger } from "../../src/shared/util";

describe("isRecord", () => {
  it.each([{}, { a: 1 }, []])("accepts %j", (value) => {
    expect(isRecord(value)).toBe(true);
  });

  it.each([null, undefined, "text", 42, true])("rejects %j", (value) => {
    expect(isRecord(value)).toBe(false);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call before the wait has elapsed", () => {
    const fn = vi.fn();
    debounce(fn, 300)();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid calls into one trailing call with the last arguments", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("a");
    vi.advanceTimersByTime(200);
    debounced("b");
    vi.advanceTimersByTime(200);
    debounced("c");
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledExactlyOnceWith("c");
  });

  it("fires again for calls made after the previous one ran", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

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
