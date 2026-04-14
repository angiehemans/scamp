# Typography

Text elements have dedicated typographic controls in the [Properties Panel](properties-panel.md).

## Creating Text

Press **T** to activate the text tool, then click and drag on the [canvas](canvas.md) to place a text element.

## Font Controls

- **Font Family** -- A searchable picker that includes Google Fonts and web-safe system fonts. Fonts are loaded from Google Fonts via CDN, so you need an internet connection for non-system fonts.
- **Font Size** -- Numeric input in pixels.
- **Font Weight** -- Select from available weights for the chosen font family.
- **Text Color** -- Opens the [Color Picker](color-picker.md).

## Alignment and Spacing

- **Text Align** -- Three icon buttons: **L** (left), **C** (center), **R** (right).
- **Line Height** -- Numeric input controlling the spacing between lines.
- **Letter Spacing** -- Numeric input for spacing between characters.

## HTML Tag Selector

Choose the semantic HTML tag for your text element:

- `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `span`, and more.

The tag you select is what appears in the generated TSX output. This affects how your content is structured in the final code.

## How Fonts Work

When you select a Google Font, Scamp adds a CDN link to load it. The font renders both on the canvas and in the generated code. Web-safe fonts (Arial, Georgia, monospace families, etc.) work offline without any CDN dependency.
