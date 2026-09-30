/**
 * Background service worker.
 *
 * Fetches lyrics pages on behalf of the content script, which cannot make
 * cross-origin requests itself. Only well-formed messages from this
 * extension's own YouTube content script are answered, and every target URL
 * is validated by the fetcher before a request is made.
 */

import browser, { type Runtime } from "webextension-polyfill";

import { isFetchRequest, type FetchResponse } from "../shared/types";
import { fetchResource } from "./fetcher";

const TRUSTED_ORIGIN = "https://www.youtube.com";

const reject = (error: "bad-request" | "forbidden"): Promise<FetchResponse> =>
  Promise.resolve({ ok: false, error });

function isTrustedSender(sender: Runtime.MessageSender): boolean {
  if (sender.id !== browser.runtime.id || !sender.url) return false;

  try {
    return new URL(sender.url).origin === TRUSTED_ORIGIN;
  } catch {
    return false;
  }
}

browser.runtime.onMessage.addListener(
  (message: unknown, sender: Runtime.MessageSender): Promise<FetchResponse> => {
    if (!isTrustedSender(sender)) return reject("forbidden");
    if (!isFetchRequest(message)) return reject("bad-request");

    return fetchResource(message.url, message.kind);
  },
);
