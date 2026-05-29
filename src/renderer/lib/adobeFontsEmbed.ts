/**
 * Parser for the two embed forms Adobe Fonts' "Web Project" dialog
 * exposes:
 *
 *   <link rel="stylesheet" href="https://use.typekit.net/abc1def.css">
 *   @import url("https://use.typekit.net/abc1def.css");
 *   https://use.typekit.net/abc1def.css   (bare URL)
 *
 * Unlike Google Fonts, the URL is opaque — `abc1def` is a kit ID and
 * tells us nothing about which families are inside. Resolving family
 * names requires a follow-up fetch (see `adobeFontsFetch.ts`).
 *
 * We deliberately do NOT accept Adobe's legacy
 * `<script src="…/abc1def.js">` embed form. That form depends on
 * runtime JS execution to inject `<style>` tags, which is awkward to
 * inject into Scamp's renderer and unnecessary — Adobe's UI defaults
 * to the modern CSS form anyway.
 */

export type ParsedAdobeEmbed = {
  url: string;
  kitId: string;
};

export type AdobeParseResult =
  | { ok: true; value: ParsedAdobeEmbed }
  | { ok: false; error: string };

const ALLOWED_HOST = 'use.typekit.net';
const KIT_PATH_RE = /^\/([a-z0-9]+)\.css$/i;

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

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return null;
};

export const parseAdobeFontsEmbed = (raw: string): AdobeParseResult => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      ok: false,
      error: 'Paste an Adobe Fonts embed link or <link> snippet.',
    };
  }

  const url = extractUrl(raw);
  if (url === null) {
    return { ok: false, error: "Couldn't find a URL in that snippet." };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'The URL is malformed.' };
  }

  if (parsed.host !== ALLOWED_HOST) {
    return {
      ok: false,
      error: `Only ${ALLOWED_HOST} URLs are supported (got ${parsed.host}).`,
    };
  }

  const pathMatch = parsed.pathname.match(KIT_PATH_RE);
  if (!pathMatch) {
    return {
      ok: false,
      error: `Expected a kit URL like https://${ALLOWED_HOST}/abc1def.css.`,
    };
  }

  const kitId = pathMatch[1]!;
  // Normalize: drop fragment and any unrelated query params so the
  // stored URL is byte-stable.
  parsed.hash = '';
  parsed.search = '';
  return {
    ok: true,
    value: {
      url: parsed.toString(),
      kitId,
    },
  };
};
