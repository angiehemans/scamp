# Text Styles

The **Typography** section of the [Design System panel](design-system.md)
manages three things: the **fonts** available to your project, a **type
scale** of reusable sizes, and named **text styles** you can apply to any
text element in one click.

For the per-element typographic controls (setting size, weight, and
color on a single text element), see [Typography](typography.md).

## Fonts

At the top of the Typography section is the **font manager**. Paste a
Google Fonts or Adobe Fonts embed link and click **Add** — Scamp adds
the corresponding `@import` to your `theme.css` and the font becomes
available everywhere: the font pickers, the canvas, and your generated
code.

You can manage fonts from **two places** — the top of the Typography
section here, and the [Settings](settings.md) page. Both write to the
same project, so use whichever is closer to hand.

## Font Families

Below the font manager, **Font families** lists your `--font-*` tokens
(e.g. `--font-sans`, `--font-mono`). These are the named families you
reference from text styles and from the per-element font picker.

## Type Scale

The **Type scale** lists your `--text-*` size tokens as editable rows.
These are plain size values (e.g. `--text-lg: 1.25rem`) that surface in
the font-size picker across the panel.

## Text Styles

A **text style** bundles a full set of typographic properties — font
family, size, weight, line height, and letter spacing — under one name,
like `H1` or `Body Large`. Applying a style sets all of those at once, so
your headings and body copy stay consistent across the whole project.

Each style is stored as a group of tokens named
`--text-<style>-<property>` (for example `--text-h1-size`,
`--text-h1-weight`, `--text-h1-leading`).

### Adding text styles

New projects start without text styles, to keep the pickers clean. When
the section is empty you get two buttons:

- **+ Add default text styles** — adds the full recommended set:
  **Display, H1, H2, H3, H4, Body Large, Body, Body Small, Label,** and
  **Code**.
- **+ Add text style** — adds a single blank style for you to define.

### The live preview

Each text style renders as a **preview row**. The row shows the style's
name followed by a sample sentence — *"H1 — The quick brown fox jumps
over the lazy dog"* — drawn in that style's own font, size, weight, line
height, and letter spacing. So you see exactly what the style looks like
applied, right in the list. Long previews truncate to a single line.

### Editing a style

Click a preview row to open the **style editor** in a popover — the same
typography controls you'd find in the Properties panel, but for the whole
style at once:

- **Font** — a searchable font picker (Google, Adobe, and system fonts,
  plus your `--font-*` tokens).
- **Size** and **Weight**, side by side.
- **Line height** and **Letter spacing**, side by side.
- A **name** field at the top to rename the style. Renaming rewrites the
  underlying token group.

Each field also accepts a token reference, so a text style can be built
from your type scale and font tokens rather than hardcoded values.

Close the popover with its **×** button or by pressing **Escape**. A
delete affordance on the row removes the style; if the style is used on
any elements, Scamp warns you with a usage count first.

### Choosing a font weight

The weight control is an **editable dropdown**. Open it to pick any of
the nine named weights:

| Value | Name | | Value | Name |
|---|---|---|---|---|
| 100 | Thin | | 500 | Medium |
| 200 | Extra Light | | 600 | Semibold |
| 300 | Light | | 700 | Bold |
| 400 | Regular | | 800 | Extra Bold |
| | | | 900 | Black |

Each option is shown *in its own weight* as a live sample. You can also
**type any value** from 1 to 1000 directly — useful for variable fonts
that support in-between weights like `350`. The matched name (e.g.
"Regular") shows next to the number, and blanks out for custom values.
Use the up/down arrow keys to step the weight.

## Applying a Text Style to an Element

Select a text element and open the **Typography** section of the
Properties panel. Use the **Text style** dropdown to apply a whole
style — it sets the element's family, size, line height, and letter
spacing to the style's token references, and its weight to the concrete
value. The dropdown reflects the currently-applied style, and the
individual size/weight/family pickers hide the internal text-style
tokens so they stay focused on plain values.
