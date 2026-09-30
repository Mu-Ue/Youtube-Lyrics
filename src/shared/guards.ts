/** Narrows `unknown` to a non-null object whose properties can be inspected. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
