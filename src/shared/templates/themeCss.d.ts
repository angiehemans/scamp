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
export declare const DEFAULT_BODY_FONT_FAMILY = "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\"";
/**
 * Sentinel comment that marks Scamp's auto-generated browser reset
 * block in `theme.css`. The backfill helper uses literal-string
 * search for this comment to decide whether the reset is present —
 * if absent, it appends the block; if present, no-op. Users can
 * freely edit / extend / delete the reset rules; we only key on the
 * sentinel, not the rules themselves.
 */
export declare const BROWSER_RESET_SENTINEL = "/* scamp: browser reset \u2014 keep canvas and preview in sync */";
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
export declare const BROWSER_RESET_BLOCK = "/* scamp: browser reset \u2014 keep canvas and preview in sync */\np,\nh1,\nh2,\nh3,\nh4,\nh5,\nh6,\nul,\nol,\ndl,\ndd,\nblockquote,\nfigure,\npre,\nhr,\nfieldset {\n  margin: 0;\n}\n\nimg,\nvideo,\niframe,\nsvg {\n  display: block;\n}\n\nbutton,\na,\nselect,\ninput,\ntextarea,\nfieldset,\nlegend {\n  all: unset;\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  display: block;\n}\n\ninput,\ntextarea,\nselect {\n  cursor: text;\n  user-select: text;\n}";
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
export declare const DEFAULT_THEME_CSS = ":root {\n  --color-primary: #3b82f6;\n  --color-secondary: #6366f1;\n  --color-background: #ffffff;\n  --color-surface: #f5f5f5;\n  --color-text: #111111;\n  --color-muted: #888888;\n\n  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n}\n\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: var(--font-sans);\n}\n\n/* scamp: browser reset \u2014 keep canvas and preview in sync */\np,\nh1,\nh2,\nh3,\nh4,\nh5,\nh6,\nul,\nol,\ndl,\ndd,\nblockquote,\nfigure,\npre,\nhr,\nfieldset {\n  margin: 0;\n}\n\nimg,\nvideo,\niframe,\nsvg {\n  display: block;\n}\n\nbutton,\na,\nselect,\ninput,\ntextarea,\nfieldset,\nlegend {\n  all: unset;\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  display: block;\n}\n\ninput,\ntextarea,\nselect {\n  cursor: text;\n  user-select: text;\n}\n";
/**
 * Default page CSS module content.
 *
 * Empty-by-default: the root element's shape is supplied by Scamp's
 * defaults (`width: 100%; height: auto; position: relative`). Only
 * user overrides land in this file, keeping the exported CSS free of
 * canvas-tool artefacts.
 */
export declare const DEFAULT_PAGE_CSS = ".root {\n}\n";
