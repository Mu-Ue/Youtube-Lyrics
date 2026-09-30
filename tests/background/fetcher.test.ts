import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchResource } from "../../src/background/fetcher";

const URL_OK = "https://genius.com/song";

/** Builds a response whose `url` reflects where a redirect chain ended. */
function reply(body: string, init: ResponseInit = {}, finalUrl = URL_OK): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: finalUrl });
  return response;
}

function stubFetch(implementation: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const mock = vi.fn(implementation);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("fetchResource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses hosts outside the allow-list without making a request", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(reply("x")));

    expect(await fetchResource("https://example.com/", "text")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the body as text and sends no credentials or referrer", async () => {
    const fetchMock = stubFetch(() => Promise.resolve(reply("<p>hi</p>")));

    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: true, data: "<p>hi</p>" });
    expect(fetchMock).toHaveBeenCalledWith(
      URL_OK,
      expect.objectContaining({ credentials: "omit", referrerPolicy: "no-referrer" }),
    );
  });

  it("parses JSON responses", async () => {
    stubFetch(() =>
      Promise.resolve(
        reply('{"a":1}', { headers: { "content-type": "application/json; charset=utf-8" } }),
      ),
    );

    expect(await fetchResource(URL_OK, "json")).toEqual({ ok: true, data: { a: 1 } });
  });

  it("rejects a JSON request answered with another content type", async () => {
    stubFetch(() => Promise.resolve(reply("{}", { headers: { "content-type": "text/html" } })));

    expect(await fetchResource(URL_OK, "json")).toEqual({ ok: false, error: "invalid-response" });
  });

  it("rejects malformed JSON", async () => {
    stubFetch(() =>
      Promise.resolve(reply("{oops", { headers: { "content-type": "application/json" } })),
    );

    expect(await fetchResource(URL_OK, "json")).toEqual({ ok: false, error: "invalid-response" });
  });

  it("discards responses that redirected off the allow-list", async () => {
    stubFetch(() => Promise.resolve(reply("secret", {}, "https://evil.example/")));

    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: false, error: "forbidden" });
  });

  it("reports non-2xx statuses as network failures", async () => {
    stubFetch(() => Promise.resolve(reply("nope", { status: 404 })));

    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: false, error: "network" });
  });

  it("rejects bodies larger than the size limit", async () => {
    stubFetch(() => Promise.resolve(reply("x".repeat(3 * 1024 * 1024 + 1))));

    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: false, error: "invalid-response" });
  });

  it("maps timeouts and other failures to typed errors", async () => {
    stubFetch(() => Promise.reject(namedError("TimeoutError")));
    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: false, error: "timeout" });

    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await fetchResource(URL_OK, "text")).toEqual({ ok: false, error: "network" });
  });
});
