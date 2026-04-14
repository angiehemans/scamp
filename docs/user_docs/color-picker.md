# Color Picker

The color picker appears whenever you click a color swatch in the [Properties Panel](properties-panel.md) -- for background, border, or text color.

## Opening the Picker

Click any color swatch button to open a popover with two tabs: **Color** and **Tokens**.

## Color Tab

- **Saturation area** -- Click or drag to choose saturation and brightness.
- **Hue slider** -- Select the base hue.
- **Alpha slider** -- Control transparency.
- **Hex input** -- Type a hex value directly (e.g. `#ff6600`).
- **Preset swatches** -- Quick-access colors at the bottom of the picker.

### Alpha and Output Format

- When alpha is 1 (fully opaque), the picker outputs `#rrggbb`.
- When alpha is less than 1, it outputs `rgba(r, g, b, a)`.

## Tokens Tab

The Tokens tab lists all [theme tokens](themes.md) defined in your project's `theme.css` file. Click any token to apply it as `var(--token-name)`.

Using tokens keeps your colors consistent. Change a token value in the theme file and every element referencing it updates.

## Project Color Swatches

The picker shows colors already used in your project, sorted by frequency. This makes it easy to reuse existing colors without memorizing hex values.
