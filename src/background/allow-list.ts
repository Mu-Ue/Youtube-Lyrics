/**
 * Allow-list for network requests issued by the background worker.
 *
 * The background worker fetches on behalf of content scripts, so every
 * target URL is validated here before a request is made. This module is the
 * single source of truth; do not duplicate the list elsewhere.
 */

/** Exact hostnames the extension may contact. Subdomains are not implied. */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "genius.com",
  "letssingit.com",
  "search.letssingit.com",
  "songlyrics.com",
  "www.songlyrics.com",
]);

/**
 * Returns `true` only for well-formed HTTPS URLs whose hostname is
 * allow-listed. URLs with embedded credentials or an explicit non-default
 * port are rejected.
 *
 * `URL.hostname` is already lower-cased and punycode-normalised, so
 * look-alike and mixed-case hosts cannot bypass the exact match.
 */
export function isAllowed(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    ALLOWED_HOSTS.has(url.hostname)
  );
}
