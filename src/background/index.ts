/**
 * Background worker. Downloads lyrics pages for the content script, which
 * cannot make cross-origin requests itself. Only well-formed messages from
 * this extension's own YouTube content script are answered.
 */

import { isFetchRequest, type FetchResponse } from "../shared/messaging";
import { fetchResource } from "./fetch";

const TRUSTED_ORIGIN = "https://www.youtube.com";

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  return (
    sender.id === chrome.runtime.id &&
    sender.url !== undefined &&
    URL.canParse(sender.url) &&
    new URL(sender.url).origin === TRUSTED_ORIGIN
  );
}

// `sendResponse` plus `return true` is the async reply style both Chrome and
// Firefox support; returning a promise from the listener is not portable.
chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: FetchResponse) => void) => {
    if (!isTrustedSender(sender)) {
      sendResponse({ ok: false, error: "forbidden" });
    } else if (!isFetchRequest(message)) {
      sendResponse({ ok: false, error: "bad-request" });
    } else {
      void fetchResource(message.url, message.kind).then(sendResponse);
      return true;
    }
    return false;
  },
);
