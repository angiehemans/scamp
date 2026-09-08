# Typography

Text elements have dedicated typographic controls in the
[properties panel](properties-panel.md). To define reusable text styles
and manage fonts for the whole project, see [Text styles](text-styles.md).

## Create text

Press **T** to select the text tool, and then drag on the
[canvas](canvas.md) to place a text element.

When a text element is selected, the **Typography** section leads the
properties panel, directly below the Element section, because it's the
main thing you edit on text.

## Apply a text style

The **Text style** list applies a whole named style (H1, Body, and so
on) to the element at once, setting its family, size, weight, line
height, and letter spacing together. Define these styles in the Design
System panel; see [Text styles](text-styles.md).

## Font controls

- **Font Family**: A searchable picker that includes Google Fonts and
  web-safe system fonts. Scamp loads fonts from the Google Fonts CDN, so
  you need an internet connection for non-system fonts.
- **Font Size**: A numeric input in pixels. The token icon on the right
  opens a picker of the size tokens declared in `theme.css`, such as
  `--text-lg`. See [Design system](design-system.md).
- **Font Weight**: An editable list. Select a named weight (100 Thin
  through 900 Black), or type any value from 1 to 1000 for variable
  fonts. See [Choose a font weight](text-styles.md#choose-a-font-weight).
- **Text Color**: Opens the [color picker](color-picker.md).

## Alignment and spacing

- **Text Align**: Three icon buttons: **L** (left), **C** (center), and
  **R** (right).
- **Line Height**: A numeric input. The token-picker icon offers any
  bare-number tokens declared in `theme.css`, such as
  `--line-height-body: 1.5;`.
- **Letter Spacing**: A numeric input for the spacing between
  characters. It shares the length-token picker with font size.

## HTML tag

Choose the semantic HTML tag for the text element: `p`, `h1` through
`h6`, `span`, and more. The tag you select appears in the generated TSX,
which determines how your content is structured in the final code.

## How fonts work

When you select a Google Font, Scamp adds a CDN link to load it. The
font renders both on the canvas and in the generated code. Web-safe
fonts—Arial, Georgia, the monospace families, and so on—work offline
without a CDN dependency.
