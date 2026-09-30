/** YouTube-specific DOM lookups and observers. */

export interface MountPoints {
  readonly description: HTMLElement;
  readonly secondary: HTMLElement;
}

/** Stops an observer or listener. */
export type Disposer = () => void;

const DESCRIPTION_SELECTOR = ".style-scope.ytd-text-inline-expander";
const SECONDARY_SELECTOR = "div#secondary.style-scope.ytd-watch-flexy";

const noop: Disposer = () => undefined;

export const isWatchPage = (): boolean => window.location.pathname === "/watch";

export const isDarkTheme = (): boolean => document.documentElement.hasAttribute("dark");

function findMountPoints(): MountPoints | null {
  const description = document.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
  const secondary = document.querySelector<HTMLElement>(SECONDARY_SELECTOR);
  return description && secondary ? { description, secondary } : null;
}

/** Calls `callback` whenever the document title changes. */
export function observeTitle(callback: () => void): Disposer {
  const titleElement = document.querySelector("title");
  if (!titleElement) return noop;

  const observer = new MutationObserver(callback);
  observer.observe(titleElement, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
}

/** Calls `callback` when YouTube switches between light and dark theme. */
export function observeTheme(callback: (dark: boolean) => void): Disposer {
  const observer = new MutationObserver(() => callback(isDarkTheme()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });
  return () => observer.disconnect();
}

/** Calls `callback` after every in-app (single-page) navigation. */
export function onNavigation(callback: () => void): Disposer {
  document.addEventListener("yt-navigate-finish", callback);
  return () => document.removeEventListener("yt-navigate-finish", callback);
}

/**
 * Invokes `callback` once the watch page has rendered the elements the panel
 * attaches to. Checks immediately, then observes only until they appear.
 */
export function waitForMountPoints(callback: (points: MountPoints) => void): Disposer {
  const tryMount = (): boolean => {
    if (!isWatchPage()) return false;

    const points = findMountPoints();
    if (!points) return false;

    callback(points);
    return true;
  };

  if (tryMount()) return noop;

  const observer = new MutationObserver(() => {
    if (tryMount()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
