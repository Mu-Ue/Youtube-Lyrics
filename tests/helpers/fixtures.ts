/**
 * Builds a stand-in for the background fetch service that answers from a
 * URL → body table and records every URL that was requested.
 */
export function createFakeNetwork(pages: Readonly<Record<string, string>>): {
  readonly requested: string[];
  readonly text: (url: string) => Promise<string | null>;
  readonly json: (url: string) => Promise<unknown>;
} {
  const requested: string[] = [];

  const lookup = (url: string): string | null => {
    requested.push(url);
    return pages[url] ?? null;
  };

  return {
    requested,
    text: (url) => Promise.resolve(lookup(url)),
    json: (url) => {
      const body = lookup(url);
      return Promise.resolve(body === null ? null : (JSON.parse(body) as unknown));
    },
  };
}
