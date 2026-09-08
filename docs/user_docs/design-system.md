# Design system

Scamp's design system lets you define your project's colors, type, and
spacing once, as named tokens, and reuse them everywhere. Tokens live in
a `theme.css` file in your project folder, and you edit the whole system
visually from the **Design System** panel.

This page is the overview. The details are in dedicated guides:

- [Colors](colors.md): Palettes and semantic color tokens
- [Text styles](text-styles.md): Fonts, the type scale, and reusable text
  styles
- [Design tokens](design-tokens.md): Spacing, border widths, radius, and
  shadows
- [Themes](themes.md): Light, dark, and custom theme switching
- [DESIGN.md](design-md.md): The generated design document for AI agents

## Open the panel

In the left sidebar rail, click the **Design System** icon. The panel
opens in place of the properties panel on the right, and the canvas
stays fully interactive while it's open. To return to the properties
panel, click the rail icon again or select an element.

A section nav on the left lists every part of your design system:
Colors, Typography, Spacing, Border widths, Radius, Shadows, and
Documentation. Click a heading to jump to that section.

## How tokens work

A token is a named value written as a CSS custom property in
`theme.css`:

```css
:root {
  --color-brand-500: #3b82f6;   /* a primitive */
  --color-primary: var(--color-brand-500);   /* a semantic token */
  --space-4: 16px;
  --radius-md: 8px;
}
```

Scamp organizes tokens into two layers:

- **Primitives**: Raw values, such as the ten shades of a color palette
  (`--color-brand-50` through `--color-brand-900`).
- **Semantic tokens**: Meaningful roles that point at a primitive, such
  as `--color-primary` pointing at `--color-brand-500`. You style your
  design against semantic tokens, and later re-point them without
  touching a single element.

Scamp routes tokens to the right panel section, and to the right pickers
in the properties panel, by name: `--color-*` tokens are colors,
`--space-*` tokens are spacing, `--text-<style>-*` tokens are text
styles, and so on. You never tag a token's category yourself.

### Resolution on the canvas

Wherever an element uses `var(--color-primary)`, the canvas follows the
chain—semantic to primitive to hex—and paints the real color, so the
preview matches your deployed page. Change a token anywhere in the
panel, and every element that uses it updates immediately, on the
canvas and in the generated CSS.

## Use tokens in the properties panel

After tokens exist, they appear as pickers throughout the properties
panel. Each field shows only the tokens that fit it:

| Field | The token picker offers |
|---|---|
| Any color field | Color tokens, through the [color picker](color-picker.md) Tokens tab |
| Font size | `--text-*` sizes and length tokens |
| Line height | Line-height tokens |
| Letter spacing | Length tokens |
| Font family | `--font-*` family tokens |
| Padding, margin, and gap | `--space-*` spacing tokens |
| Border width | `--border-*` width tokens |
| Border radius | `--radius-*` radius tokens |
| Box shadow | `--shadow-*` presets |

Spacing, border, radius, and typography fields have a small token icon
on the inside right of the input. Click it for a list of the eligible
tokens. The icon highlights in the accent color when the field holds a
token reference. You can still type literal values, or mix them, such
as `16 var(--space-4)`, whenever you want.

To apply a whole text style at once, use the **Text style** list in the
Typography section. See [Text styles](text-styles.md).

## New projects and existing projects

- **New projects** are scaffolded with a starter design system: five
  color palettes (Brand, Neutral, Error, Warning, and Success), a set of
  semantic color tokens, and a default font. Spacing, radius, shadow, and
  text-style defaults are added on demand. Each section has an
  **Add default …** button, so your pickers stay uncluttered until you
  opt in. Everything is fully editable, so you can change the defaults or
  delete them and start fresh.
- **Existing projects** are left exactly as they are. Whatever tokens
  your `theme.css` already declares are preserved and shown; Scamp never
  restructures them for you.

## Edit theme.css by hand

The panel is the primary author of `theme.css`, but it respects
hand-written CSS. Any rules, comments, or values you add to the file
directly are preserved when the panel rewrites the managed token blocks.
And because Scamp watches the file, edits made in your editor or by an
AI agent reload into the panel and the canvas automatically. See
[Bidirectional sync](bidirectional-sync.md).

**Note:** Projects created before the design system upgrade open the
panel in a read-only state with a short migration notice, so their
existing tokens are never rewritten by accident.
