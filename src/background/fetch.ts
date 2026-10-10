/**
 * Network layer of the background worker.
 *
 * Every request is checked against an exact-match host allow-list (before the
 * request and again after redirects), bounded in time and size, sent without
 * credentials or referrer, and reports failures as typed values.
 */

import type { FetchErrorCode, FetchKind, FetchResponse } from "../shared/messaging";

/**
 * Exact hostnames the extension may contact; subdomains are not implied.
 * Must match `host_permissions` in manifest.json (enforced by a test).
 */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "genius.com",
  "letssingit.com",
  "search.letssingit.com",
  "songlyrics.com",
  "www.songlyrics.com",
]);

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const ACCEPT_HEADERS: Readonly<Record<FetchKind, string>> = {
  json: "application/json",
  text: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
};

const failure = (error: FetchErrorCode): FetchResponse => ({ ok: false, error });

const toErrorCode = (error: unknown): FetchErrorCode =>
  error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";

/**
 * `true` only for HTTPS URLs on an allow-listed host, without credentials or
 * an explicit port. `URL.hostname` is lower-cased and punycode-normalised, so
 * mixed-case and look-alike hosts cannot slip past the exact match.
 */
export function isAllowed(rawUrl: string): boolean {
  if (!URL.canParse(rawUrl)) return false;
  const url = new URL(rawUrl);

  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    ALLOWED_HOSTS.has(url.hostname)
  );
}

/** Why a response cannot be used, or `null` if it can. */
function rejectionReason(response: Response, kind: FetchKind): FetchErrorCode | null {
  // The browser follows redirects itself, so the final URL is checked as well.
  if (!isAllowed(response.url)) return "forbidden";
  // Callers only care that nothing usable came back, not about the status code.
  if (!response.ok) return "network";

  const contentType = response.headers.get("content-type") ?? "";
  if (kind === "json" && !contentType.includes("application/json")) return "invalid-response";
  return null;
}

/** Reads the body as UTF-8 text, or returns `null` once it exceeds the size limit. */
async function readBoundedText(response: Response): Promise<string | null> {
  if (Number(response.headers.get("content-length")) > MAX_BODY_BYTES) {
    await response.body?.cancel();
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());
  return chunks.join("");
}

/** Fetches an allow-listed URL and returns its body as text or parsed JSON. Never rejects. */
export async function fetchResource(url: string, kind: FetchKind): Promise<FetchResponse> {
  if (!isAllowed(url)) return failure("forbidden");

  try {
    const response = await fetch(url, {
      headers: { Accept: ACCEPT_HEADERS[kind] },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const rejection = rejectionReason(response, kind);
    if (rejection) {
      await response.body?.cancel();
      return failure(rejection);
    }

    const body = await readBoundedText(response);
    if (body === null) return failure("invalid-response");
    return { ok: true, data: kind === "json" ? (JSON.parse(body) as unknown) : body };
  } catch (error) {
    return failure(error instanceof SyntaxError ? "invalid-response" : toErrorCode(error));
  }
}
