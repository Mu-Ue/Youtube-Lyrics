/**
 * Network layer used by the background worker.
 *
 * Every call is re-validated against the host allow-list (defence in depth),
 * bounded in time and size, sent without credentials or referrer, and reports
 * failures as typed values instead of throwing or returning `null`.
 */

import { isAllowed } from "./allow-list";
import type { FetchErrorCode, FetchKind, FetchResponse } from "../shared/types";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const ACCEPT_HEADERS: Readonly<Record<FetchKind, string>> = {
  json: "application/json",
  text: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
};

const failure = (error: FetchErrorCode): FetchResponse => ({ ok: false, error });

/**
 * Reads a response body as UTF-8 text, aborting once it exceeds the size
 * limit. Returns `null` when the limit is hit.
 */
async function readBoundedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    await response.body?.cancel();
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function toErrorCode(error: unknown): FetchErrorCode {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
}

/**
 * Fetches an allow-listed URL and returns its body as text or parsed JSON.
 *
 * Redirects are followed by the browser, so the final URL is validated
 * against the allow-list as well and the response is discarded if it left it.
 */
export async function fetchResource(url: string, kind: FetchKind): Promise<FetchResponse> {
  if (!isAllowed(url)) return failure("forbidden");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: ACCEPT_HEADERS[kind] },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!isAllowed(response.url)) {
      await response.body?.cancel();
      return failure("forbidden");
    }

    // Non-2xx statuses are reported as "network": callers only need to know
    // that no usable document was obtained.
    if (!response.ok) {
      await response.body?.cancel();
      return failure("network");
    }

    if (kind === "json") {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        await response.body?.cancel();
        return failure("invalid-response");
      }
    }

    const body = await readBoundedText(response);
    if (body === null) return failure("invalid-response");

    if (kind === "text") return { ok: true, data: body };

    try {
      return { ok: true, data: JSON.parse(body) as unknown };
    } catch {
      return failure("invalid-response");
    }
  } catch (error) {
    return failure(toErrorCode(error));
  }
}
