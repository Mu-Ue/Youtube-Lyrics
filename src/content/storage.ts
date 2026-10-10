/**
 * Persistent panel settings, kept in extension storage. Unlike the page's
 * `localStorage`, this is isolated from scripts running on youtube.com.
 */

import { isRecord, logger } from "../shared/util";

export interface PanelSettings {
  /** Whether the lyrics panel is expanded. */
  readonly open: boolean;
  /** Whether the panel sits below the description instead of in the sidebar. */
  readonly insideDescription: boolean;
}

export const DEFAULT_SETTINGS: PanelSettings = { open: false, insideDescription: false };

const STORAGE_KEY = "panelSettings";

/** Loads settings, falling back to defaults for missing or malformed data. */
export async function loadSettings(): Promise<PanelSettings> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];
    if (!isRecord(value)) return DEFAULT_SETTINGS;

    return {
      open: value["open"] === true,
      insideDescription: value["insideDescription"] === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: PanelSettings): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  } catch (error) {
    logger.warn("Could not save settings", error);
  }
}
