// templates/themeCss.ts — theme.css / page.css scaffolding: font default, browser reset, theme tokens.
// Split out of src/shared/agentMd.ts (4.6); re-exported via the barrel.
/**
 * The default cross-platform "system font" stack. Same shape used by
 * GitHub, Bootstrap, and the Tailwind/Next.js community: each browser
 * resolves to its native UI font (San Francisco on macOS / iOS, Segoe
 * UI on Windows, Roboto on Android, system-ui on modern Linux). Last
 * three entries cover emoji glyphs so emoji render correctly inline
 * regardless of the body font.
 *
 * Used as the value of `--font-sans` in the project's auto-generated
 * `theme.css`, and as the canvas frame's fallback when the project
 * hasn't set the token. Without this, the preview window defaults to
 * the browser's serif (Liberation Serif on Linux) while the canvas
 * inherits Scamp's chrome font — a confusing visual mismatch.
 */
export const DEFAULT_BODY_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
/**
 * Sentinel comment that marks Scamp's auto-generated browser reset
 * block in `theme.css`. The backfill helper uses literal-string
 * search for this comment to decide whether the reset is present —
 * if absent, it appends the block; if present, no-op. Users can
 * freely edit / extend / delete the reset rules; we only key on the
 * sentinel, not the rules themselves.
 */
export const BROWSER_RESET_SENTINEL = '/* scamp: browser reset — keep canvas and preview in sync */';
/**
 * Browser-default reset that mirrors what `ElementRenderer` applies
 * inline on the canvas. Without this, the deployed page (preview /
 * `next dev` / production) inherits browser-default margins,
 * heading sizes, list indentation, link underlines, and form-control
 * chrome — none of which the canvas shows. The two surfaces then
 * visibly disagree.
 *
 * Three independent groups:
 *
 *   1. Zero default margins on every block-level semantic tag the
 *      canvas already zeros via inline style (`margin: 0` in
 *      `elementToStyle`).
 *   2. Force `display: block` on replaced media elements so the
 *      baseline gap inline-block elements get goes away — matches
 *      the canvas's `display: block` for `image`-type elements.
 *   3. `all: unset` on interactive / form tags so user-authored
 *      styles are the only thing that paints on these elements —
 *      mirrors the canvas's `.element:is(button, a, …) { all: unset; … }`
 *      rule. Caret + text selection are restored on inputs because
 *      `all: unset` strips them.
 *
 * Users who want browser-default behaviour back on a specific tag
 * can delete or override the relevant rules. The block is loud and
 * commented so its purpose is obvious.
 */
export const BROWSER_RESET_BLOCK = `${BROWSER_RESET_SENTINEL}
p,
h1,
h2,
h3,
h4,
h5,
h6,
ul,
ol,
dl,
dd,
blockquote,
figure,
pre,
hr,
fieldset {
  margin: 0;
}

img,
video,
iframe,
svg {
  display: block;
}

button,
a,
select,
input,
textarea,
fieldset,
legend {
  all: unset;
  box-sizing: border-box;
  font: inherit;
  color: inherit;
  display: block;
}

input,
textarea,
select {
  cursor: text;
  user-select: text;
}`;
/**
 * Default theme.css content for a freshly created project. Provides:
 *
 *   - A starter palette of color tokens
 *   - A default `--font-sans` font stack
 *   - A `body` rule that applies the font as the page-wide default
 *   - A universal `box-sizing: border-box` reset so `width: 100%`
 *     plus padding doesn't overflow the parent (matches every
 *     modern CSS framework's default and matches the canvas's
 *     element renderer, which already applies border-box inline)
 *   - A targeted browser-default reset (margins on block tags,
 *     `display: block` on replaced media, `all: unset` on
 *     interactive / form tags) so canvas and preview render the
 *     same unstyled element identically
 *
 * Users can change the default font for the whole project by editing
 * the `--font-sans` value here. Per-element overrides (via the
 * Typography section) win over this body-level default.
 */
export const DEFAULT_THEME_CSS = `:root {
  --color-primary: #3b82f6;
  --color-secondary: #6366f1;
  --color-background: #ffffff;
  --color-surface: #f5f5f5;
  --color-text: #111111;
  --color-muted: #888888;

  --font-sans: ${DEFAULT_BODY_FONT_FAMILY};
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
}

${BROWSER_RESET_BLOCK}
`;
/**
 * Default page CSS module content.
 *
 * Empty-by-default: the root element's shape is supplied by Scamp's
 * defaults (`width: 100%; height: auto; position: relative`). Only
 * user overrides land in this file, keeping the exported CSS free of
 * canvas-tool artefacts.
 */
export const DEFAULT_PAGE_CSS = `.root {
}
`;
