/**
 * The message contract between the content script and the background worker,
 * plus the content-side client.
 *
 * Content scripts cannot make cross-origin requests, so page downloads are
 * delegated to the background worker. Messages cross a trust boundary, so
 * both directions are validated at runtime instead of trusting static types.
 */

import { isRecord } from "./util";

/** How the background worker should interpret the response body. */
export type FetchKind = "json" | "text";

export interface FetchRequest {
  readonly type: "fetch";
  readonly kind: FetchKind;
  readonly url: string;
}

export type FetchErrorCode =
  "bad-request" | "forbidden" | "network" | "timeout" | "invalid-response";

export type FetchResponse =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: FetchErrorCode };

export function isFetchRequest(value: unknown): value is FetchRequest {
  return (
    isRecord(value) &&
    value["type"] === "fetch" &&
    (value["kind"] === "json" || value["kind"] === "text") &&
    typeof value["url"] === "string"
  );
}

function isFetchResponse(value: unknown): value is FetchResponse {
  if (!isRecord(value)) return false;
  return value["ok"] === true ? "data" in value : typeof value["error"] === "string";
}

async function request(url: string, kind: FetchKind): Promise<FetchResponse> {
  const message: FetchRequest = { type: "fetch", kind, url };

  try {
    const reply: unknown = await chrome.runtime.sendMessage(message);
    return isFetchResponse(reply) ? reply : { ok: false, error: "invalid-response" };
  } catch {
    // Thrown when the extension was reloaded or updated under a live page.
    return { ok: false, error: "network" };
  }
}

/** Downloads a page as text, or returns `null` on any failure. */
export async function fetchText(url: string): Promise<string | null> {
  const response = await request(url, "text");
  return response.ok && typeof response.data === "string" ? response.data : null;
}

/** Downloads and parses a JSON document, or returns `null` on any failure. */
export async function fetchJson(url: string): Promise<unknown> {
  const response = await request(url, "json");
  return response.ok ? response.data : null;
}
