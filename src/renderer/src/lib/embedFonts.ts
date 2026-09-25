/**
 * `@font-face` rules with the font files inlined, for a capture.
 *
 * A capture rasterises through `<img src="data:image/svg+xml,…">`, and
 * that document cannot fetch anything. A webfont the page loads over
 * the network is simply unavailable inside it, so the text falls back
 * — which is why every thumbnail came out in the wrong typeface for a
 * project whose design uses one.
 *
 * `skipFonts` was set for a real reason: html-to-image's own walk reads
 * `cssRules` on every sheet, which throws for a cross-origin one —
 * Google Fonts here — and it logs each failure. That part was right.
 * What followed it ("those fonts could never be embedded anyway") was
 * not: the SHEET cannot be read cross-origin, but it can be fetched by
 * href, and the font files it points at serve CORS headers. So they are
 * fetched here instead of read, and handed to html-to-image as
 * `fontEmbedCSS`, which makes it skip its own walk entirely.
 *
 * see docs/notes/project-thumbnails.md
 */

/** One `@font-face { … }` block. */
const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;

/** A `url(…)`, however it is quoted. */
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/**
 * How much font to inline before giving up.
 *
 * A Google Fonts stylesheet declares a face per weight per unicode
 * range, so a six-weight family is dozens of files. The families in use
 * are filtered first, and this is the backstop for the page that uses a
 * lot of them: a thumbnail is not worth ten megabytes of base64.
 */
export const MAX_EMBED_BYTES = 2_000_000;

/** The `font-family` a rule declares, unquoted and lowercased. */
export const familyOf = (fontFace: string): string | null => {
  const match = fontFace.match(/font-family\s*:\s*([^;]+)/i);
  const raw = match?.[1]?.trim();
  if (raw === undefined || raw.length === 0) return null;
  return raw.replace(/^['"]|['"]$/g, '').toLowerCase();
};

/**
 * The families actually set on a subtree, as `font-family` head names.
 *
 * Embedding every face a project declares would put fonts nothing on
 * the page uses into every capture.
 */
export const familiesUsedIn = (root: Element): Set<string> => {
  const out = new Set<string>();
  const add = (el: Element): void => {
    const stack = window.getComputedStyle(el).fontFamily;
    for (const part of stack.split(',')) {
      const name = part.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
      if (name.length > 0) out.add(name);
    }
  };
  add(root);
  for (const el of root.querySelectorAll('*')) add(el);
  return out;
};

/** Every `@font-face` block in some CSS, for a family that is in use. */
export const fontFacesFor = (css: string, families: ReadonlySet<string>): string[] => {
  const out: string[] = [];
  for (const block of css.match(FONT_FACE_RE) ?? []) {
    const family = familyOf(block);
    if (family !== null && families.has(family)) out.push(block);
  }
  return out;
};

/** Read a stylesheet's text, fetching it when the browser will not read it. */
const cssTextOf = async (sheet: CSSStyleSheet): Promise<string> => {
  try {
    const rules = Array.from(sheet.cssRules);
    const parts: string[] = [];
    for (const rule of rules) {
      // An `@import` of a cross-origin sheet is the Google Fonts case:
      // the rule is readable, the sheet it points at is not.
      const imported = (rule as CSSImportRule).styleSheet;
      if (imported !== undefined && imported !== null) {
        parts.push(await cssTextOf(imported));
        continue;
      }
      parts.push(rule.cssText);
    }
    return parts.join('\n');
  } catch {
    if (!sheet.href) return '';
    try {
      const response = await fetch(sheet.href);
      return response.ok ? await response.text() : '';
    } catch {
      return '';
    }
  }
};

/** A URL as a `data:` URI, or null when it cannot be had. */
const asDataUri = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Build the CSS to hand html-to-image as `fontEmbedCSS`.
 *
 * Returns an empty string when there is nothing to embed, which is the
 * common case for a design on system fonts — the caller then leaves
 * `skipFonts` on and nothing is fetched at all.
 */
export const buildFontEmbedCss = async (root: Element): Promise<string> => {
  const families = familiesUsedIn(root);
  if (families.size === 0) return '';

  const sheets = await Promise.all(
    Array.from(document.styleSheets).map((sheet) => cssTextOf(sheet))
  );
  const faces = fontFacesFor(sheets.join('\n'), families);
  if (faces.length === 0) return '';

  const out: string[] = [];
  let bytes = 0;
  for (const face of faces) {
    const urls = [...face.matchAll(URL_RE)].map((m) => m[2] ?? '');
    let rewritten = face;
    let ok = urls.length === 0;
    for (const url of urls) {
      if (url.startsWith('data:')) {
        ok = true;
        continue;
      }
      const absolute = new URL(url, document.baseURI).href;
      const data = await asDataUri(absolute);
      if (data === null) continue;
      rewritten = rewritten.replace(url, data);
      bytes += data.length;
      ok = true;
    }
    if (ok) out.push(rewritten);
    if (bytes >= MAX_EMBED_BYTES) break;
  }
  return out.join('\n');
};
