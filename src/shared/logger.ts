/**
 * The only place in the extension that talks to the console. Keeping it in
 * one module gives every message the same prefix and lets ESLint forbid
 * stray `console` calls elsewhere.
 *
 * Only warnings and errors are emitted; nothing is logged on the happy path.
 */

const PREFIX = "[YouTube Lyrics]";

function format(message: string, error: unknown): unknown[] {
  return error === undefined ? [`${PREFIX} ${message}`] : [`${PREFIX} ${message}`, error];
}

export const logger = {
  /** Something failed but the extension carries on (for example one provider). */
  warn(message: string, error?: unknown): void {
    console.warn(...format(message, error));
  },

  /** Something failed that the extension cannot recover from. */
  error(message: string, error?: unknown): void {
    console.error(...format(message, error));
  },
};
