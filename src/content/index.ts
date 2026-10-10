/**
 * Content script entry point. Wires the YouTube page, the lyrics panel and
 * the providers together.
 *
 * In videos with chapters (e.g. mixes), lyrics follow the current chapter, so
 * they update automatically when the next song starts.
 *
 * Lyrics are only requested while the panel is open, so browsing YouTube with
 * the panel collapsed causes no network traffic to lyrics sites.
 */

import { findLyrics } from "../providers";
import { debounce, logger } from "../shared/util";
import { LyricsPanel } from "./panel";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type PanelSettings } from "./storage";
import { filterTitle, getVideoTitle } from "./title";
import * as YouTube from "./youtube";

const LOOKUP_DEBOUNCE_MS = 300;
const NO_TITLE_MESSAGE = "Could not determine the song title. Try the search field.";
const NOT_FOUND_MESSAGE = "No lyrics found for this video. Try searching manually.";

let settings: PanelSettings = DEFAULT_SETTINGS;
let lastAutoQuery = "";
let pending: AbortController | undefined; // the lookup that currently owns the panel

function updateSettings(change: Partial<PanelSettings>): void {
  settings = { ...settings, ...change };
  void saveSettings(settings);
}

const panel = new LyricsPanel({
  onToggle: () => {
    updateSettings({ open: !settings.open });
    panel.setOpen(settings.open);
    void lookup();
  },
  onMove: () => {
    updateSettings({ insideDescription: !settings.insideDescription });
    panel.setPlacement(settings.insideDescription, true);
  },
  onSearch: (query) => {
    if (!query) lastAutoQuery = ""; // an empty search re-runs the automatic lookup
    void lookup(query);
  },
});

/**
 * Looks up lyrics. Without `manualQuery` the query is derived from the video
 * title and skipped off the watch page, while the panel is closed, or when the
 * title is unchanged.
 */
async function lookup(manualQuery = ""): Promise<void> {
  const isAutomatic = manualQuery === "";
  // The title also changes on the home page, search results, etc.
  if (isAutomatic && !YouTube.isWatchPage()) return;

  // In a mix, the current chapter names the song that is playing.
  const query = isAutomatic
    ? filterTitle(YouTube.getChapterTitle() || getVideoTitle(document.title))
    : manualQuery;

  if (!query) {
    if (!isAutomatic || settings.open) panel.showMessage(NO_TITLE_MESSAGE);
    return;
  }

  if (isAutomatic) {
    if (!settings.open || query === lastAutoQuery) return;
    lastAutoQuery = query;
  }

  // Superseding the previous lookup stops it from querying further providers
  // and keeps its late result from overwriting this one.
  pending?.abort();
  const { signal } = (pending = new AbortController());
  panel.showLoading();

  const result = await findLyrics(query, { signal });
  if (signal.aborted) return;

  if (result) panel.showResult(result);
  else panel.showMessage(NOT_FOUND_MESSAGE);
}

async function main(): Promise<void> {
  settings = await loadSettings();
  panel.setOpen(settings.open);
  panel.setPlacement(settings.insideDescription);
  panel.setDark(YouTube.isDarkTheme());

  let stopWaiting: YouTube.Disposer = () => undefined;
  // Shared so a navigation's title and chapter changes collapse into one lookup.
  const scheduleLookup = debounce(() => void lookup(), LOOKUP_DEBOUNCE_MS);

  const ensureMounted = (): void => {
    if (!YouTube.isWatchPage() || panel.isMounted) return;

    stopWaiting();
    stopWaiting = YouTube.waitForMountPoints(({ description, secondary }) => {
      panel.mount(description, secondary);
      YouTube.observeChapter(scheduleLookup);
      void lookup();
    });
  };

  // These live as long as the page. There is deliberately no teardown on
  // `pagehide`: it would leave the extension dead after a back/forward-cache restore.
  YouTube.observeTitle(scheduleLookup);
  YouTube.observeTheme((dark) => panel.setDark(dark));
  YouTube.onNavigation(ensureMounted);

  ensureMounted();
}

main().catch((error: unknown) => logger.error("Failed to initialise", error));
