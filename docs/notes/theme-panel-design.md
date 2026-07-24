# Design System panel — visual language

The panel had accumulated too many borders: group cards (`.palette`,
`.themeBlock`) were outlined boxes on the same-ish background as the page,
every token row (`.tokenRow`) was its own outlined card, every editable
input carried a resting border, and every section title had an underline.
Borders were doing all the visual work, producing a grid of hairlines.

The cleanup follows one rule — **spend definition where it carries
meaning, remove it everywhere else** — realized as:

- **Group containers** (`.palette`, `.themeBlock`) use a raised fill
  (`--bg-raised`) and a larger radius instead of a border. One soft
  surface, no outline.
- **Token rows** are borderless and transparent at rest, revealing a
  `--bg-hover` fill on hover. Separation comes from row rhythm, not an
  outline per row. Hover uses `--bg-hover` (not `--bg-raised`) so it
  reads both on the panel surface and inside a raised group block.
- **Inputs** (`.tokenName`, `.paletteName`, `.tokenValue`,
  `.shadowValue`, `.semanticSelect`, `input.themeBlockName`) are
  transparent with a `1px solid transparent` border at rest, an inset
  `--bg-input` fill on hover, and an accent edge on focus. The
  transparent border reserves layout so focus doesn't shift anything.
- **Section titles** dropped their underline — weight + spacing separate
  sections now.
- The only intentional outline left is the dashed **"add" zone**
  (`.addButton`), one per section, where dashed means "insert here".

## The palette ramp is the signature

Color is the most characteristic content on a design-system page, so the
palette is the one loud element. Each palette renders as a **continuous
ramp**: ten equal-width color blocks that touch (`gap: 0`), with only the
outer ends rounded (`:first-child` / `:last-child` on `.shadeSwatch`), so
the palette reads as a single object rather than ten chips. Shade numbers
sit quietly beneath in a tabular caption.

This needed a **swatch-only `ColorInput`** (`swatchOnly` prop): it renders
just the color button filling its cell — no hex field, no divider — and
inherits corner rounding from its container so the ramp ends round while
inner blocks stay square. The hex still lives in the picker popover on
click. The default `ColorInput` (swatch + hex row) is unchanged, so every
other call site is unaffected.
