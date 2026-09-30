/**
 * Shared type definitions and the runtime message contract between the
 * content script and the background service worker.
 *
 * This module has no side effects, so it is safe to load from any extension
 * context.
 */

import { isRecord } from "./guards";

/** A successfully resolved set of lyrics. */
export interface LyricsResult {
  readonly title: string;
  readonly url: string;
  readonly lyrics: string;
}

/** How the background worker should interpret the response body. */
export type FetchKind = "json" | "text";

/** Message sent from the content script to the background worker. */
export interface FetchRequest {
  readonly type: "fetch";
  readonly kind: FetchKind;
  readonly url: string;
}

/** Reasons a background fetch can fail. */
export type FetchErrorCode =
  "bad-request" | "forbidden" | "network" | "timeout" | "invalid-response";

/** Reply from the background worker. Discriminated on `ok`. */
export type FetchResponse =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: FetchErrorCode };

/**
 * Runtime guard for incoming messages. Extension messages cross a trust
 * boundary, so the shape is verified instead of trusting the static type.
 */
export function isFetchRequest(value: unknown): value is FetchRequest {
  if (!isRecord(value)) return false;

  const kind = value["kind"];
  return (
    value["type"] === "fetch" &&
    (kind === "json" || kind === "text") &&
    typeof value["url"] === "string"
  );
}
