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

| Script              | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `npm run build`     | Production build into `extension/`                 |
| `npm run dev`       | Rebuild on change (unminified, inline source maps) |
| `npm run typecheck` | Type-check with `tsc`                              |
| `npm run lint`      | Lint with ESLint                                   |
| `npm run format`    | Format with Prettier                               |
| `npm test`          | Run the unit tests with Vitest                     |
| `npm run test:coverage` | Run the tests with a coverage report and thresholds |
| `npm run test:live`     | Check each provider against the real website (needs network) |
| `npm run check`     | Typecheck, lint, format check and tests            |
| `npm run audit`     | Audit production dependencies for known issues     |

The extension version lives in `package.json`; the build copies it into the generated
`manifest.json`, and fails if the manifest references a file that was not produced.
CI (`.github/workflows/ci.yml`) runs `check`, `build` and `audit` on every push and pull request.

## Architecture

```
src/
├── background/        Service worker: performs allow-listed network requests
│   ├── index.ts       Message entry point (sender and payload validation)
│   ├── allow-list.ts  Single source of truth for permitted hosts
│   └── fetcher.ts     Timeouts, size limits, redirect checks, typed errors
├── content/           Runs on youtube.com
│   ├── index.ts       Wires page, panel and providers together
│   ├── panel.ts       Lyrics panel UI (plain DOM, no innerHTML, search landmark, accessible status region)
│   ├── youtube.ts     YouTube-specific selectors and observers
│   ├── title.ts       Video title → search query
│   ├── storage.ts     Persistent panel settings
│   └── styles.css
├── providers/         One module per lyrics site, plus fallback and LRU cache
└── shared/            Message types, messaging client, logger, type guards, utilities
assets/icons/          Extension icons (copied into the build)
tests/                 Unit tests, mirroring the layout of src/ (background, content, providers, shared)
```

Tests live in `tests/` and run in jsdom with the browser APIs mocked.

Content scripts cannot make cross-origin requests, so they ask the background worker to
download pages. The worker only answers well-formed messages from this extension's own
youtube.com content script, and only fetches HTTPS URLs on an exact-match host allow-list.

## Permissions

| Permission                                                                                      | Why                                                        |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `storage`                                                                                       | Remembers whether the panel is open and where it is placed |
| `genius.com`, `letssingit.com`, `search.letssingit.com`, `songlyrics.com`, `www.songlyrics.com` | Lets the background worker download lyrics pages           |
| Content script on `https://www.youtube.com/*`                                                   | Shows the panel on YouTube watch pages                     |

## Browser compatibility

Chrome and other Chromium browsers 121+, and Firefox 121+. Chrome 121 is the first version that
accepts both `background.service_worker` and `background.scripts`, which is how one manifest
serves both browsers.

## Disclaimer

Lyrics are the property of their respective owners. The extension fetches them on demand from
third-party sites for display only and does not store them.
