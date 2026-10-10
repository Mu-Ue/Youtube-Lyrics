import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LyricsResult } from "../../src/providers";

/** Everything the mocked collaborators expose to the test. */
const h = vi.hoisted(() => {
  interface Handlers {
    onToggle: () => void;
    onMove: () => void;
    onSearch: (query: string) => void;
  }

  return {
    handlers: undefined as Handlers | undefined,
    panel: {
      isMounted: false,
      mount: vi.fn(),
      setOpen: vi.fn(),
      setPlacement: vi.fn(),
      setDark: vi.fn(),
      showLoading: vi.fn(),
      showResult: vi.fn(),
      showMessage: vi.fn(),
    },
    findLyrics: vi.fn<(query: string, options: { signal: AbortSignal }) => Promise<unknown>>(),
    loadSettings: vi.fn<() => Promise<{ open: boolean; insideDescription: boolean }>>(),
    saveSettings: vi.fn(),
    watchPage: true,
    onTitleChange: undefined as (() => void) | undefined,
    chapter: "",
    onChapterChange: undefined as (() => void) | undefined,
    onMountPoints: undefined as ((points: unknown) => void) | undefined,
    onNavigate: undefined as (() => void) | undefined,
  };
});

vi.mock("../../src/providers", () => ({ findLyrics: h.findLyrics }));

vi.mock("../../src/content/storage", () => ({
  DEFAULT_SETTINGS: { open: false, insideDescription: false },
  loadSettings: h.loadSettings,
  saveSettings: h.saveSettings,
}));

vi.mock("../../src/content/panel", () => ({
  LyricsPanel: class {
    constructor(handlers: NonNullable<typeof h.handlers>) {
      h.handlers = handlers;
    }
    get isMounted(): boolean {
      return h.panel.isMounted;
    }
    mount = h.panel.mount;
    setOpen = h.panel.setOpen;
    setPlacement = h.panel.setPlacement;
    setDark = h.panel.setDark;
    showLoading = h.panel.showLoading;
    showResult = h.panel.showResult;
    showMessage = h.panel.showMessage;
  },
}));

vi.mock("../../src/content/youtube", () => ({
  isWatchPage: () => h.watchPage,
  isDarkTheme: () => false,
  observeTitle: (callback: () => void) => {
    h.onTitleChange = callback;
  },
  getChapterTitle: () => h.chapter,
  observeChapter: (callback: () => void) => {
    h.onChapterChange = callback;
  },
  observeTheme: () => undefined,
  onNavigation: (callback: () => void) => {
    h.onNavigate = callback;
  },
  waitForMountPoints: (callback: (points: unknown) => void) => {
    h.onMountPoints = callback;
    return vi.fn();
  },
}));

const NO_TITLE = "Could not determine the song title. Try the search field.";
const NOT_FOUND = "No lyrics found for this video. Try searching manually.";

const billieJean: LyricsResult = {
  title: "Michael Jackson – Billie Jean Lyrics",
  url: "https://genius.com/Michael-jackson-billie-jean-lyrics",
  lyrics: "fixture lyrics for billie jean",
};
const thriller: LyricsResult = {
  title: "Thriller",
  url: "https://search.letssingit.com/lyrics/michael-jackson/thriller.html",
  lyrics: "fixture lyrics for thriller",
};

/** A promise the test resolves by hand, to control response ordering. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

/** Loads the content script fresh and lets `main()` finish. */
async function boot(settings = { open: true, insideDescription: false }): Promise<void> {
  h.loadSettings.mockResolvedValue(settings);
  await import("../../src/content/index");
  await flush();
}

/** Simulates YouTube rendering the mount points, which triggers the first lookup. */
async function mountPanel(): Promise<void> {
  h.onMountPoints?.({ description: document.body, secondary: document.body });
  await flush();
}

function setVideoTitle(title: string): void {
  document.title = title;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  h.handlers = undefined;
  h.onTitleChange = undefined;
  h.chapter = "";
  h.onChapterChange = undefined;
  h.onMountPoints = undefined;
  h.onNavigate = undefined;
  h.watchPage = true;
  h.panel.isMounted = false;
  h.findLyrics.mockReset();
  h.findLyrics.mockResolvedValue(billieJean);
  h.saveSettings.mockResolvedValue(undefined);
  setVideoTitle("Michael Jackson - Billie Jean (Official Video) - YouTube");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("automatic lookups", () => {
  it("cleans the video title into the query and shows the result", async () => {
    await boot();
    await mountPanel();

    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson billie jean",
      expect.anything(),
    );
    expect(h.panel.showLoading).toHaveBeenCalledTimes(1);
    expect(h.panel.showResult).toHaveBeenCalledExactlyOnceWith(billieJean);
  });

  it("does nothing while the panel is closed", async () => {
    await boot({ open: false, insideDescription: false });
    await mountPanel();

    expect(h.findLyrics).not.toHaveBeenCalled();
    expect(h.panel.showMessage).not.toHaveBeenCalled();
  });

  it("does nothing off the watch page", async () => {
    await boot();
    h.watchPage = false;
    await mountPanel();

    expect(h.findLyrics).not.toHaveBeenCalled();
    expect(h.panel.showMessage).not.toHaveBeenCalled();
  });

  it("skips a repeat lookup when the query is unchanged", async () => {
    await boot();
    await mountPanel();

    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(h.findLyrics).toHaveBeenCalledTimes(1);
  });

  it("looks up again when the title changes to a different song", async () => {
    await boot();
    await mountPanel();

    setVideoTitle("Michael Jackson - Thriller (Official Video) - YouTube");
    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson thriller", expect.anything());
    expect(h.findLyrics).toHaveBeenCalledTimes(2);
  });

  it("shows a hint when no title can be derived and the panel is open", async () => {
    setVideoTitle("- YouTube");
    await boot();
    await mountPanel();

    expect(h.findLyrics).not.toHaveBeenCalled();
    expect(h.panel.showMessage).toHaveBeenCalledExactlyOnceWith(NO_TITLE);
  });

  it("stays silent when no title can be derived and the panel is closed", async () => {
    setVideoTitle("- YouTube");
    await boot({ open: false, insideDescription: false });
    await mountPanel();

    expect(h.panel.showMessage).not.toHaveBeenCalled();
  });

  it("reports when no provider has the lyrics", async () => {
    h.findLyrics.mockResolvedValue(null);
    await boot();
    await mountPanel();

    expect(h.panel.showMessage).toHaveBeenCalledExactlyOnceWith(NOT_FOUND);
    expect(h.panel.showResult).not.toHaveBeenCalled();
  });
});

describe("chapters", () => {
  it("prefers the current chapter over the video title", async () => {
    setVideoTitle("Best of Michael Jackson Mix - YouTube");
    h.chapter = "Michael Jackson - Billie Jean";
    await boot();
    await mountPanel();

    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson billie jean",
      expect.anything(),
    );
  });

  it("looks up the next song when the chapter changes", async () => {
    h.chapter = "Michael Jackson - Billie Jean";
    await boot();
    await mountPanel();

    h.chapter = "Michael Jackson - Thriller";
    h.onChapterChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(h.findLyrics).toHaveBeenCalledTimes(2);
    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson thriller", expect.anything());
  });

  it("falls back to the video title when there are no chapters", async () => {
    await boot();
    await mountPanel();

    expect(h.onChapterChange).toBeDefined();
    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson billie jean",
      expect.anything(),
    );
  });
});

describe("debounce", () => {
  it("collapses a burst of title mutations into one lookup", async () => {
    await boot();
    await mountPanel();
    h.findLyrics.mockClear();

    setVideoTitle("Michael Jackson - Thriller (Official Video) - YouTube");
    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(100);
    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(100);
    h.onTitleChange?.();

    await vi.advanceTimersByTimeAsync(299);
    expect(h.findLyrics).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson thriller",
      expect.anything(),
    );
  });
});

describe("manual searches", () => {
  it("bypass the closed-panel and unchanged-query rules", async () => {
    await boot({ open: false, insideDescription: false });
    await mountPanel();

    h.handlers?.onSearch("michael jackson thriller");
    await flush();
    h.handlers?.onSearch("michael jackson thriller");
    await flush();

    expect(h.findLyrics).toHaveBeenCalledTimes(2);
    expect(h.findLyrics).toHaveBeenCalledWith("michael jackson thriller", expect.anything());
  });

  it("work off the watch page", async () => {
    await boot();
    h.watchPage = false;

    h.handlers?.onSearch("michael jackson beat it");
    await flush();

    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson beat it",
      expect.anything(),
    );
  });

  it("an empty search re-runs the automatic lookup even for the same title", async () => {
    await boot();
    await mountPanel();
    expect(h.findLyrics).toHaveBeenCalledTimes(1);

    h.handlers?.onSearch("");
    await flush();

    expect(h.findLyrics).toHaveBeenCalledTimes(2);
    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson billie jean", expect.anything());
  });

  it("do not reset the automatic query, so the same title stays skipped", async () => {
    await boot();
    await mountPanel();

    h.handlers?.onSearch("michael jackson thriller");
    await flush();
    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(h.findLyrics).toHaveBeenCalledTimes(2);
  });
});

describe("stale lookups", () => {
  it("discards a slow response that a newer lookup has overtaken", async () => {
    await boot();

    const slow = deferred<LyricsResult>();
    const fast = deferred<LyricsResult>();
    h.findLyrics.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    h.handlers?.onSearch("michael jackson billie jean");
    h.handlers?.onSearch("michael jackson thriller");

    fast.resolve(thriller);
    await flush();
    slow.resolve(billieJean);
    await flush();

    expect(h.panel.showResult).toHaveBeenCalledExactlyOnceWith(thriller);
  });

  it("also discards a stale 'not found' message", async () => {
    await boot();

    const slow = deferred<null>();
    h.findLyrics.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(thriller);

    h.handlers?.onSearch("first");
    h.handlers?.onSearch("second");
    await flush();
    slow.resolve(null);
    await flush();

    expect(h.panel.showMessage).not.toHaveBeenCalled();
    expect(h.panel.showResult).toHaveBeenCalledExactlyOnceWith(thriller);
  });

  it("aborts the overtaken lookup so it stops querying providers", async () => {
    await boot();
    h.findLyrics.mockReturnValue(new Promise(() => undefined));

    h.handlers?.onSearch("first");
    h.handlers?.onSearch("second");

    const [first, second] = h.findLyrics.mock.calls.map(([, options]) => options.signal);
    expect(first?.aborted).toBe(true);
    expect(second?.aborted).toBe(false);
  });
});

describe("panel controls", () => {
  it("toggling flips and persists the open state, then looks up", async () => {
    await boot({ open: false, insideDescription: false });
    await mountPanel();
    expect(h.findLyrics).not.toHaveBeenCalled();

    h.handlers?.onToggle();
    await flush();

    expect(h.panel.setOpen).toHaveBeenLastCalledWith(true);
    expect(h.saveSettings).toHaveBeenCalledWith({ open: true, insideDescription: false });
    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith(
      "michael jackson billie jean",
      expect.anything(),
    );
  });

  it("moving flips and persists the placement", async () => {
    await boot();

    h.handlers?.onMove();

    expect(h.panel.setPlacement).toHaveBeenLastCalledWith(true, true);
    expect(h.saveSettings).toHaveBeenCalledWith({ open: true, insideDescription: true });
  });
});

describe("lifecycle", () => {
  it("mounts only on the watch page and only once it is not mounted", async () => {
    h.watchPage = false;
    await boot();
    expect(h.onMountPoints).toBeUndefined();

    h.watchPage = true;
    h.onNavigate?.();
    expect(h.onMountPoints).toBeDefined();
  });

  it("does not wait for mount points when the panel is already mounted", async () => {
    h.panel.isMounted = true;
    await boot();

    expect(h.onMountPoints).toBeUndefined();
  });

  it("keeps working after a back/forward-cache round trip", async () => {
    await boot();
    await mountPanel();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));

    setVideoTitle("Michael Jackson - Thriller (Official Video) - YouTube");
    h.onTitleChange?.();
    await vi.advanceTimersByTimeAsync(300);

    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson thriller", expect.anything());
  });
});
