# YouTube Lyrics

A browser extension that shows song lyrics next to the YouTube video you are watching.

- Looks lyrics up on Genius, LetsSingIt and SongLyrics (in that order)
- Collapsible panel that can sit in the sidebar or below the description, with light and dark themes
- Manual search field for videos whose title cannot be parsed

## Getting started

Requires Node.js 20.19 or newer.

```bash
npm install
npm run build      # production build into extension/  (Windows: build.bat)
npm run dev        # rebuild on change
```

Load the extension in Chrome (121+): open `chrome://extensions`, enable **Developer mode**,
choose **Load unpacked** and select the `extension/` folder.

In Firefox (121+), open `about:debugging`, choose **This Firefox** and load `extension/manifest.json`
as a temporary add-on.

## Scripts

| Script           | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `npm run build`  | Production build into `extension/`                 |
| `npm run dev`    | Rebuild on change (unminified, inline source maps) |
| `npm test`       | Run the unit tests                                 |
| `npm run check`  | Typecheck, lint, format check and tests (CI)       |
| `npm run format` | Format with Prettier                               |

The version lives in `package.json`; the build copies it into the generated `manifest.json`.

## Architecture

```
src/
├── background/   Service worker: validates messages, fetches allow-listed HTTPS pages
├── content/      Runs on youtube.com: panel UI, title parsing, YouTube DOM hooks, settings
├── providers/    One module per lyrics site, plus fallback order and an LRU cache
└── shared/       Message contract and small utilities
```

Content scripts cannot make cross-origin requests, so they ask the background worker to
download pages. The worker only answers well-formed messages from this extension's own
youtube.com content script, and only fetches HTTPS URLs on an exact-match host allow-list
(checked again after redirects), with a timeout, a size limit and no cookies or referrer.
Lyrics are only requested while the panel is open. The extension has no runtime dependencies.

## Permissions

| Permission                                                                                      | Why                                                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `storage`                                                                                       | Remembers whether the panel is open and where it is placed |
| `genius.com`, `letssingit.com`, `search.letssingit.com`, `songlyrics.com`, `www.songlyrics.com` | Lets the background worker download lyrics pages           |
| Content script on `https://www.youtube.com/*`                                                   | Shows the panel on YouTube watch pages                     |

## Disclaimer

Lyrics are the property of their respective owners. The extension fetches them on demand from
third-party sites for display only and does not store them.
