/**
 * Pure helpers that turn a YouTube page title into a lyrics search query.
 * This module has no side effects and is safe to import anywhere.
 */

const BRACKET_PATTERNS = [/\[[^\]]*\]/g, /\([^)]*\)/g, /\{[^}]*\}/g, /«[^»]*»/g] as const;
const EDGE_SEPARATORS = /^[-–—·•○\s]+|[-–—·•○\s]+$/g;
const ARTIST_SONG_SEPARATOR = /\s+[-–—]\s+/;
const NOISE_PHRASES =
  /\b(?:official\s+(?:music\s+)?(?:video|audio|lyric\s+video)|(?:music|lyric)\s+video|lyrics?|hd|4k)\b/gi;
const FEATURING = /\b(?:featuring|feat|ft)\b\.?\s*[,;]?\s*\S+/gi;
const AMPERSAND_OR_PIPE = /[&|]/g;
const QUOTES = /['"‘’“”`]/g;
const MULTI_SPACE = /\s{2,}/g;
const YOUTUBE_SUFFIX = /\s*-\s*YouTube$/;

/** Removes bracketed content, repeating until stable to handle nesting. */
function stripBrackets(input: string): string {
  let current = input;
  let previous: string;

  do {
    previous = current;
    for (const pattern of BRACKET_PATTERNS) current = current.replace(pattern, " ");
  } while (current !== previous);

  return current;
}

/** Removes video noise ("official video", "feat. …", quotes) from one fragment. */
function cleanFragment(fragment: string): string {
  return fragment
    .replace(NOISE_PHRASES, "")
    .replace(FEATURING, "")
    .replace(AMPERSAND_OR_PIPE, " ")
    .replace(QUOTES, "")
    .replace(MULTI_SPACE, " ")
    .trim();
}

/** Strips the " - YouTube" suffix from `document.title`. */
export function getVideoTitle(documentTitle: string): string {
  return documentTitle.replace(YOUTUBE_SUFFIX, "").trim();
}

/**
 * Cleans a raw video title into a lowercase "artist song" query.
 *
 * @example
 * filterTitle("Artist ft. Guest – Song (Official Video)"); // "artist song"
 */
export function filterTitle(raw: string): string {
  const title = stripBrackets(raw.trim()).replace(EDGE_SEPARATORS, "").trim();

  let artist = "";
  let song = title;
  const separator = ARTIST_SONG_SEPARATOR.exec(title);
  if (separator) {
    artist = title.slice(0, separator.index);
    song = title.slice(separator.index + separator[0].length);
  }

  return [cleanFragment(artist), cleanFragment(song)]
    .filter(Boolean)
    .join(" ")
    .replace(MULTI_SPACE, " ")
    .trim()
    .toLowerCase();
}
