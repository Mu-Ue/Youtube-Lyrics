/**
 * Content-side client for the background fetch service.
 *
 * Content scripts cannot make cross-origin requests, so page downloads are
 * delegated to the background worker. Failures are reduced to `null` here
 * because callers only need to know whether a document was obtained.
 */

import browser from "webextension-polyfill";

import { isRecord } from "./guards";
import type { FetchKind, FetchRequest, FetchResponse } from "./types";

function isFetchResponse(value: unknown): value is FetchResponse {
  if (!isRecord(value)) return false;
  if (value["ok"] === true) return "data" in value;
  return value["ok"] === false && typeof value["error"] === "string";
}

async function request(url: string, kind: FetchKind): Promise<FetchResponse> {
  const message: FetchRequest = { type: "fetch", kind, url };

  try {
    const reply: unknown = await browser.runtime.sendMessage(message);
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
