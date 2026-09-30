/**
 * Content script entry point. Wires the YouTube page, the lyrics panel and
 * the providers together.
 *
 * Lyrics are only requested while the panel is open, so browsing YouTube with
 * the panel collapsed causes no network traffic to lyrics sites.
 */

import { findLyrics } from "../providers";
import { debounce } from "../shared/debounce";
import { logger } from "../shared/logger";
import { LyricsPanel } from "./panel";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type PanelSettings } from "./storage";
import { filterTitle, getVideoTitle } from "./title";
import * as YouTube from "./youtube";

const LOOKUP_DEBOUNCE_MS = 300;
const NO_TITLE_MESSAGE = "Could not determine the song title. Try the search field.";
const NOT_FOUND_MESSAGE = "No lyrics found for this video. Try searching manually.";

let settings: PanelSettings = DEFAULT_SETTINGS;
let lastAutoQuery = "";
let generation = 0; // incremented per lookup so stale responses are discarded

const panel = new LyricsPanel({
  onToggle: () => {
    settings = { ...settings, open: !settings.open };
    panel.setOpen(settings.open);
    void saveSettings(settings);
    void lookup();
  },
  onMove: () => {
    settings = { ...settings, insideDescription: !settings.insideDescription };
    panel.setPlacement(settings.insideDescription, true);
    void saveSettings(settings);
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

  const query = isAutomatic ? filterTitle(getVideoTitle(document.title)) : manualQuery;

  if (!query) {
    if (!isAutomatic || settings.open) panel.showMessage(NO_TITLE_MESSAGE);
    return;
  }

  if (isAutomatic) {
    if (!settings.open || query === lastAutoQuery) return;
    lastAutoQuery = query;
  }

  const current = ++generation;
  panel.showLoading();

  const result = await findLyrics(query);
  if (current !== generation) return; // a newer lookup owns the panel now

  if (result) panel.showResult(result);
  else panel.showMessage(NOT_FOUND_MESSAGE);
}

async function main(): Promise<void> {
  settings = await loadSettings();
  panel.setOpen(settings.open);
  panel.setPlacement(settings.insideDescription);
  panel.setDark(YouTube.isDarkTheme());

  const debouncedLookup = debounce(() => void lookup(), LOOKUP_DEBOUNCE_MS);
  let stopWaiting: YouTube.Disposer = () => undefined;

  const ensureMounted = (): void => {
    if (!YouTube.isWatchPage() || panel.isMounted) return;

    stopWaiting();
    stopWaiting = YouTube.waitForMountPoints(({ description, secondary }) => {
      panel.mount(description, secondary);
      void lookup();
    });
  };

  const disposers: YouTube.Disposer[] = [
    YouTube.observeTitle(debouncedLookup),
    YouTube.observeTheme((dark) => panel.setDark(dark)),
    YouTube.onNavigation(ensureMounted),
  ];

  window.addEventListener("pagehide", () => {
    stopWaiting();
    for (const dispose of disposers) dispose();
    panel.destroy();
  });

  ensureMounted();
}

main().catch((error: unknown) => logger.error("Failed to initialise", error));
