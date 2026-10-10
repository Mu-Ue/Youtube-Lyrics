/** Small helpers shared by every extension context. */

/** Narrows `unknown` to a non-null object whose properties can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Coalesces rapid consecutive calls into a single trailing call. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

const PREFIX = "[YouTube Lyrics]";

/**
 * The only place in the extension that talks to the console, so every message
 * carries the same prefix. Nothing is logged on the happy path.
 */
export const logger = {
  warn: (message: string, ...details: unknown[]): void =>
    console.warn(`${PREFIX} ${message}`, ...details),
  error: (message: string, ...details: unknown[]): void =>
    console.error(`${PREFIX} ${message}`, ...details),
};
