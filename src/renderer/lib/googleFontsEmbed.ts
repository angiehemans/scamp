/**
 * Parser for the three forms Google Fonts' "Get embed code" tab
 * exposes:
 *
 *   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" rel="stylesheet">
 *   @import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');
 *   https://fonts.googleapis.com/css2?family=Inter&display=swap   (bare URL)
 *
 * We only accept Google Fonts URLs so users can't paste arbitrary
 * stylesheets into the font system — those should stay as hand-
 * edited `@import` lines the user writes themselves.
 */

export type ParsedGoogleEmbed = {
  url: string;
  families: string[];
};

export type ParseResult =
  | { ok: true; value: ParsedGoogleEmbed }
  | { ok: false; error: string };

const ALLOWED_HOSTS = new Set(['fonts.googleapis.com']);
const ALLOWED_PATHS = new Set(['/css', '/css2']);

const HREF_RE = /<link\b[^>]*?\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i;
const IMPORT_URL_RE =
  /@import\s+url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)/i;
const IMPORT_BARE_RE = /@import\s+(?:"([^"]+)"|'([^']+)')/i;

const extractUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const link = trimmed.match(HREF_RE);
  if (link) return (link[1] ?? link[2] ?? '').trim();

  const imp = trimmed.match(IMPORT_URL_RE);
  if (imp) return (imp[1] ?? imp[2] ?? imp[3] ?? '').trim();

  const bare = trimmed.match(IMPORT_BARE_RE);
  if (bare) return (bare[1] ?? bare[2] ?? '').trim();

  // Plain URL form — accept if it parses as a URL.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return null;
};

/**
 * Turn a Google Fonts URL's `family=Inter+Tight:wght@400..700` segment
 * back into a human-readable family name. Handles `+` → space,
 * strips the `:wght@…` axis spec, decodes percent-encoding.
 */
const prettyFamily = (raw: string): string => {
  let name = raw.trim();
  if (name.length === 0) return name;
  try {
    name = decodeURIComponent(name);
  } catch {
    // Keep the raw value if decoding fails.
  }
  name = name.replace(/\+/g, ' ');
  const colonIdx = name.indexOf(':');
  if (colonIdx !== -1) name = name.slice(0, colonIdx);
  return name.trim();
};

/**
 * Drop a single family from a Google Fonts URL.
 *
 *   - Returns the rewritten URL when other families remain.
 *   - Returns `null` when the removed family was the last one, so
 *     the caller knows to drop the URL entry entirely.
 *   - Returns the input unchanged when the URL can't be parsed or
 *     the family isn't found — the safe default so a bug doesn't
 *     wipe the user's theme.
 *
 * Matches families by their display name (the result of
 * `prettyFamily`), not by the raw `family=...:wght@...` segment, so
 * the caller can pass the same string we show in the UI.
 */
export const removeFamilyFromUrl = (
  url: string,
  family: string
): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const all = parsed.searchParams.getAll('family');
  if (all.length === 0) return url;
  const kept = all.filter((raw) => prettyFamily(raw) !== family);
  if (kept.length === all.length) return url;
  if (kept.length === 0) return null;
  parsed.searchParams.delete('family');
  for (const raw of kept) parsed.searchParams.append('family', raw);
  return parsed.toString();
};

export const parseGoogleFontsEmbed = (raw: string): ParseResult => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'Paste a Google Fonts embed link or <link> snippet.' };
  }

  const url = extractUrl(raw);
  if (url === null) {
    return {
      ok: false,
      error: "Couldn't find a URL in that snippet.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'The URL is malformed.' };
  }

  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return {
      ok: false,
      error: `Only fonts.googleapis.com URLs are supported (got ${parsed.host}).`,
    };
  }
  if (!ALLOWED_PATHS.has(parsed.pathname)) {
    return {
      ok: false,
      error: `Expected a /css or /css2 Google Fonts URL.`,
    };
  }

  const families = parsed.searchParams.getAll('family').map(prettyFamily).filter(
    (f) => f.length > 0
  );
  if (families.length === 0) {
    return {
      ok: false,
      error: 'That URL doesn\'t reference any font families.',
    };
  }

  // Normalize the URL we store — drop the fragment but preserve all
  // query params (weights, display, subset).
  parsed.hash = '';
  return {
    ok: true,
    value: {
      url: parsed.toString(),
      families: [...new Set(families)],
    },
  };
};
