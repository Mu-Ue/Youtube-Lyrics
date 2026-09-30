import { describe, expect, it } from "vitest";

import { ALLOWED_HOSTS, isAllowed } from "../../src/background/allow-list";

describe("isAllowed", () => {
  it.each([...ALLOWED_HOSTS])("accepts https://%s", (host) => {
    expect(isAllowed(`https://${host}/some/path?q=1`)).toBe(true);
  });

  it.each([
    ["an unlisted host", "https://google.com/search"],
    ["a subdomain that is not listed", "https://evil.genius.com/"],
    ["a look-alike host", "https://genius.com.evil.example/"],
    ["a trailing-dot host", "https://genius.com./"],
    ["plain http", "http://genius.com/"],
    ["embedded credentials", "https://user:pass@genius.com/"],
    ["a custom port", "https://genius.com:8443/"],
    ["a non-http scheme", "javascript:alert(1)"],
    ["a malformed URL", "not-a-valid-url"],
    ["an empty string", ""],
  ])("rejects %s", (_description, url) => {
    expect(isAllowed(url)).toBe(false);
  });

  it("is case-insensitive about the hostname", () => {
    expect(isAllowed("https://GENIUS.com/")).toBe(true);
  });
});
