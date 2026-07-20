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
 *   - A structured colour system: five primitive palettes (brand,
 *     neutral, error, warning, success) each with a 50–900 shade ramp,
 *     plus semantic tokens (`--color-primary`, `--color-text`, …) that
 *     reference the primitives. The Design System → Colors panel reads
 *     and edits these as palettes + semantic mappings.
 *   - A typography scale: `--font-sans` / `--font-mono` families, a
 *     `--text-*` size ramp, and `--leading-*` line-heights.
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
 * Spacing / radius / shadow tokens are intentionally NOT scaffolded
 * yet — they'd classify as lengths and land in the Typography section
 * until Phase 5 gives them dedicated, name-aware sections.
 *
 * Users can change the default font for the whole project by editing
 * the `--font-sans` value here. Per-element overrides (via the
 * Typography section) win over this body-level default.
 */
export declare const DEFAULT_THEME_CSS = ":root {\n  /* Primitives \u2014 brand */\n  --color-brand-50: #eff6ff;\n  --color-brand-100: #dbeafe;\n  --color-brand-200: #bfdbfe;\n  --color-brand-300: #93c5fd;\n  --color-brand-400: #60a5fa;\n  --color-brand-500: #3b82f6;\n  --color-brand-600: #2563eb;\n  --color-brand-700: #1d4ed8;\n  --color-brand-800: #1e40af;\n  --color-brand-900: #1e3a8a;\n\n  /* Primitives \u2014 neutral */\n  --color-neutral-50: #f8fafc;\n  --color-neutral-100: #f1f5f9;\n  --color-neutral-200: #e2e8f0;\n  --color-neutral-300: #cbd5e1;\n  --color-neutral-400: #94a3b8;\n  --color-neutral-500: #64748b;\n  --color-neutral-600: #475569;\n  --color-neutral-700: #334155;\n  --color-neutral-800: #1e293b;\n  --color-neutral-900: #0f172a;\n\n  /* Primitives \u2014 error */\n  --color-error-50: #fef2f2;\n  --color-error-100: #fee2e2;\n  --color-error-200: #fecaca;\n  --color-error-300: #fca5a5;\n  --color-error-400: #f87171;\n  --color-error-500: #ef4444;\n  --color-error-600: #dc2626;\n  --color-error-700: #b91c1c;\n  --color-error-800: #991b1b;\n  --color-error-900: #7f1d1d;\n\n  /* Primitives \u2014 warning */\n  --color-warning-50: #fffbeb;\n  --color-warning-100: #fef3c7;\n  --color-warning-200: #fde68a;\n  --color-warning-300: #fcd34d;\n  --color-warning-400: #fbbf24;\n  --color-warning-500: #f59e0b;\n  --color-warning-600: #d97706;\n  --color-warning-700: #b45309;\n  --color-warning-800: #92400e;\n  --color-warning-900: #78350f;\n\n  /* Primitives \u2014 success */\n  --color-success-50: #f0fdf4;\n  --color-success-100: #dcfce7;\n  --color-success-200: #bbf7d0;\n  --color-success-300: #86efac;\n  --color-success-400: #4ade80;\n  --color-success-500: #22c55e;\n  --color-success-600: #16a34a;\n  --color-success-700: #15803d;\n  --color-success-800: #166534;\n  --color-success-900: #14532d;\n\n  /* Semantic */\n  --color-primary: var(--color-brand-500);\n  --color-secondary: var(--color-neutral-600);\n  --color-background: var(--color-neutral-50);\n  --color-surface: var(--color-neutral-100);\n  --color-text: var(--color-neutral-900);\n  --color-muted: var(--color-neutral-500);\n  --color-border: var(--color-neutral-200);\n  --color-error: var(--color-error-500);\n  --color-warning: var(--color-warning-500);\n  --color-success: var(--color-success-500);\n\n  /* Typography */\n  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\";\n  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace;\n\n  --text-xs: 0.75rem;\n  --text-sm: 0.875rem;\n  --text-base: 1rem;\n  --text-lg: 1.125rem;\n  --text-xl: 1.25rem;\n  --text-2xl: 1.5rem;\n  --text-3xl: 1.875rem;\n  --text-4xl: 2.25rem;\n\n  --leading-tight: 1.25;\n  --leading-normal: 1.5;\n  --leading-relaxed: 1.75;\n}\n\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: var(--font-sans);\n}\n\n/* scamp: browser reset \u2014 keep canvas and preview in sync */\np,\nh1,\nh2,\nh3,\nh4,\nh5,\nh6,\nul,\nol,\ndl,\ndd,\nblockquote,\nfigure,\npre,\nhr,\nfieldset {\n  margin: 0;\n}\n\nimg,\nvideo,\niframe,\nsvg {\n  display: block;\n}\n\nbutton,\na,\nselect,\ninput,\ntextarea,\nfieldset,\nlegend {\n  all: unset;\n  box-sizing: border-box;\n  font: inherit;\n  color: inherit;\n  display: block;\n}\n\ninput,\ntextarea,\nselect {\n  cursor: text;\n  user-select: text;\n}\n";
/**
 * Default page CSS module content.
 *
 * Empty-by-default: the root element's shape is supplied by Scamp's
 * defaults (`width: 100%; height: auto; position: relative`). Only
 * user overrides land in this file, keeping the exported CSS free of
 * canvas-tool artefacts.
 */
export declare const DEFAULT_PAGE_CSS = ".root {\n}\n";
