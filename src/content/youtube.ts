/** YouTube-specific DOM lookups and observers. */

export interface MountPoints {
  readonly description: HTMLElement;
  readonly secondary: HTMLElement;
}

/** Stops an observer. */
export type Disposer = () => void;

const DESCRIPTION_SELECTOR = ".style-scope.ytd-text-inline-expander";
const SECONDARY_SELECTOR = "div#secondary.style-scope.ytd-watch-flexy";

export const isWatchPage = (): boolean => window.location.pathname === "/watch";

export const isDarkTheme = (): boolean => document.documentElement.hasAttribute("dark");

function findMountPoints(): MountPoints | null {
  const description = document.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
  const secondary = document.querySelector<HTMLElement>(SECONDARY_SELECTOR);
  return description && secondary ? { description, secondary } : null;
}

/** Calls `callback` whenever the document title changes. */
export function observeTitle(callback: () => void): void {
  const titleElement = document.querySelector("title");
  if (!titleElement) return;

  new MutationObserver(callback).observe(titleElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/** Calls `callback` when YouTube switches between light and dark theme. */
export function observeTheme(callback: (dark: boolean) => void): void {
  new MutationObserver(() => callback(isDarkTheme())).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dark"],
  });
}

/** Calls `callback` after every in-app (single-page) navigation. */
export function onNavigation(callback: () => void): void {
  document.addEventListener("yt-navigate-finish", callback);
}

/**
 * Invokes `callback` once the watch page has rendered the elements the panel
 * attaches to. Checks immediately, then observes only until they appear.
 *
 * YouTube mutates the DOM constantly, so the lookup runs at most once per
 * animation frame rather than once per mutation batch.
 */
export function waitForMountPoints(callback: (points: MountPoints) => void): Disposer {
  const tryMount = (): boolean => {
    const points = isWatchPage() ? findMountPoints() : null;
    if (points) callback(points);
    return points !== null;
  };

  if (tryMount()) return () => undefined;

  let frame = 0;
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      if (tryMount()) stop();
    });
  });
  const stop = (): void => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };

  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}
