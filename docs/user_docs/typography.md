# Typography

Text elements have dedicated typographic controls in the [Properties Panel](properties-panel.md).
For defining reusable **text styles** and managing fonts project-wide,
see [Text Styles](text-styles.md).

## Creating Text

Press **T** to activate the text tool, then click and drag on the [canvas](canvas.md) to place a text element.

When a text element is selected, the **Typography** section leads the
Properties panel — it sits directly below the Element type, since it's
the primary thing you'll edit on text.

## Applying a Text Style

The **Text style** dropdown applies a whole named style (H1, Body, …) to
the element at once — setting its family, size, weight, line height, and
letter spacing together. Define these styles in the Design System panel;
see [Text Styles](text-styles.md).

## Font Controls

- **Font Family** -- A searchable picker that includes Google Fonts and web-safe system fonts. Fonts are loaded from Google Fonts via CDN, so you need an internet connection for non-system fonts.
- **Font Size** -- Numeric input in pixels. A token icon on the
  right opens a picker of size tokens declared in `theme.css`
  (`--text-lg`, etc.) — see [Design System](design-system.md).
- **Font Weight** -- An editable dropdown. Pick a named weight (100 Thin
  through 900 Black), or type any value from 1 to 1000 for variable
  fonts. See [Text Styles](text-styles.md#choosing-a-font-weight).
- **Text Color** -- Opens the [Color Picker](color-picker.md).

## Alignment and Spacing

- **Text Align** -- Three icon buttons: **L** (left), **C** (center), **R** (right).
- **Line Height** -- Numeric input. The token-picker icon offers
  any bare-number tokens declared in `theme.css` (e.g.
  `--line-height-body: 1.5;`).
- **Letter Spacing** -- Numeric input for spacing between
  characters. Shares the length-token picker with font-size.

## HTML Tag Selector

Choose the semantic HTML tag for your text element:

- `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `span`, and more.

The tag you select is what appears in the generated TSX output. This affects how your content is structured in the final code.

## How Fonts Work

When you select a Google Font, Scamp adds a CDN link to load it. The font renders both on the canvas and in the generated code. Web-safe fonts (Arial, Georgia, monospace families, etc.) work offline without any CDN dependency.
