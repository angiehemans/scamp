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
/**
 * How much font to inline before giving up.
 *
 * A Google Fonts stylesheet declares a face per weight per unicode
 * range, so a six-weight family is dozens of files. The families in use
 * are filtered first, and this is the backstop for the page that uses a
 * lot of them: a thumbnail is not worth ten megabytes of base64.
 */
export declare const MAX_EMBED_BYTES = 2000000;
/** The `font-family` a rule declares, unquoted and lowercased. */
export declare const familyOf: (fontFace: string) => string | null;
/**
 * The families actually set on a subtree, as `font-family` head names.
 *
 * Embedding every face a project declares would put fonts nothing on
 * the page uses into every capture.
 */
export declare const familiesUsedIn: (root: Element) => Set<string>;
/** Every code point in some text, for matching against a `unicode-range`. */
export declare const codePointsOf: (text: string) => Set<number>;
/**
 * Does a `unicode-range` include any of these code points?
 *
 * A face with no range covers everything, which is what a self-hosted
 * single-file font looks like.
 */
export declare const rangeCovers: (unicodeRange: string | null, codePoints: ReadonlySet<number>) => boolean;
/** The `unicode-range` a rule declares, or null when it declares none. */
export declare const unicodeRangeOf: (fontFace: string) => string | null;
/**
 * The `@font-face` blocks a capture actually needs: a family that is in
 * use, covering a character that is on the page.
 *
 * The second half is not an optimisation. A Google Fonts stylesheet is
 * a face per weight PER SUBSET — six weights of one family is 42 rules
 * — and it orders `latin` LAST in each group of seven. Embedding them
 * in order filled the byte cap on cyrillic, greek and vietnamese that
 * no English page renders, and stopped before the latin faces the text
 * was actually set in. The font fell back, and only on the projects
 * with enough weights or families to reach the cap.
 */
export declare const fontFacesFor: (css: string, families: ReadonlySet<string>, codePoints: ReadonlySet<number>) => string[];
/**
 * Build the CSS to hand html-to-image as `fontEmbedCSS`.
 *
 * Returns an empty string when there is nothing to embed, which is the
 * common case for a design on system fonts — the caller then leaves
 * `skipFonts` on and nothing is fetched at all.
 */
export declare const buildFontEmbedCss: (root: Element) => Promise<string>;
