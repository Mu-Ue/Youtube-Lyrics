import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { LyricsResult } from "../../src/shared/types";

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
      destroy: vi.fn(),
      setOpen: vi.fn(),
      setPlacement: vi.fn(),
      setDark: vi.fn(),
      showLoading: vi.fn(),
      showResult: vi.fn(),
      showMessage: vi.fn(),
    },
    findLyrics: vi.fn<(query: string) => Promise<unknown>>(),
    loadSettings: vi.fn<() => Promise<{ open: boolean; insideDescription: boolean }>>(),
    saveSettings: vi.fn(),
    watchPage: true,
    onTitleChange: undefined as (() => void) | undefined,
    onMountPoints: undefined as ((points: unknown) => void) | undefined,
    onNavigate: undefined as (() => void) | undefined,
    disposers: [] as ReturnType<typeof vi.fn>[],
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
    destroy = h.panel.destroy;
    setOpen = h.panel.setOpen;
    setPlacement = h.panel.setPlacement;
    setDark = h.panel.setDark;
    showLoading = h.panel.showLoading;
    showResult = h.panel.showResult;
    showMessage = h.panel.showMessage;
  },
}));

vi.mock("../../src/content/youtube", () => {
  const disposer = (): ReturnType<typeof vi.fn> => {
    const dispose = vi.fn();
    h.disposers.push(dispose);
    return dispose;
  };

  return {
    isWatchPage: () => h.watchPage,
    isDarkTheme: () => false,
    observeTitle: (callback: () => void) => {
      h.onTitleChange = callback;
      return disposer();
    },
    observeTheme: () => disposer(),
    onNavigation: (callback: () => void) => {
      h.onNavigate = callback;
      return disposer();
    },
    waitForMountPoints: (callback: (points: unknown) => void) => {
      h.onMountPoints = callback;
      return disposer();
    },
  };
});

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

const flush = (): Promise<void> => vi.advanceTimersByTimeAsync(0);

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

let addListener: MockInstance<typeof window.addEventListener>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.clearAllMocks();
  addListener = vi.spyOn(window, "addEventListener");
  h.handlers = undefined;
  h.onTitleChange = undefined;
  h.onMountPoints = undefined;
  h.onNavigate = undefined;
  h.disposers.length = 0;
  h.watchPage = true;
  h.panel.isMounted = false;
  h.findLyrics.mockReset();
  h.findLyrics.mockResolvedValue(billieJean);
  h.saveSettings.mockResolvedValue(undefined);
  setVideoTitle("Michael Jackson - Billie Jean (Official Video) - YouTube");
});

afterEach(() => {
  // Each boot registers a fresh `pagehide` listener on the shared window.
  for (const [type, listener] of addListener.mock.calls) {
    if (type === "pagehide") window.removeEventListener(type, listener as EventListener);
  }
  addListener.mockRestore();
  vi.useRealTimers();
});

describe("automatic lookups", () => {
  it("cleans the video title into the query and shows the result", async () => {
    await boot();
    await mountPanel();

    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith("michael jackson billie jean");
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

    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson thriller");
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
    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith("michael jackson thriller");
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
    expect(h.findLyrics).toHaveBeenCalledWith("michael jackson thriller");
  });

  it("work off the watch page", async () => {
    await boot();
    h.watchPage = false;

    h.handlers?.onSearch("michael jackson beat it");
    await flush();

    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith("michael jackson beat it");
  });

  it("an empty search re-runs the automatic lookup even for the same title", async () => {
    await boot();
    await mountPanel();
    expect(h.findLyrics).toHaveBeenCalledTimes(1);

    h.handlers?.onSearch("");
    await flush();

    expect(h.findLyrics).toHaveBeenCalledTimes(2);
    expect(h.findLyrics).toHaveBeenLastCalledWith("michael jackson billie jean");
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
    expect(h.findLyrics).toHaveBeenCalledExactlyOnceWith("michael jackson billie jean");
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

  it("tears everything down on pagehide", async () => {
    await boot();

    window.dispatchEvent(new Event("pagehide"));

    expect(h.panel.destroy).toHaveBeenCalledTimes(1);
    for (const dispose of h.disposers) expect(dispose).toHaveBeenCalled();
  });
});
