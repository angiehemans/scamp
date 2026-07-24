# Design System

Scamp's design system lets you define your project's colors, type,
and spacing once — as named tokens — and reuse them everywhere. Tokens
live in a `theme.css` file in your project folder, and the whole system
is edited visually from the **Design System panel**.

This page is the overview. The details live in dedicated guides:

- [Colors](colors.md) — palettes and semantic color tokens
- [Text Styles](text-styles.md) — fonts, type scale, and reusable text styles
- [Design Tokens](design-tokens.md) — spacing, border widths, radius, and shadows
- [Themes](themes.md) — light / dark / custom theme switching
- [DESIGN.md](design-md.md) — the auto-generated design document for AI agents

## Opening the Panel

Click the **Design System** icon in the left sidebar rail. The panel
opens in place of the Properties panel on the right, and the canvas
stays fully interactive while it's open. Click the rail icon again (or
select an element) to return to the Properties panel.

A left-hand **section nav** lists every part of your design system —
Colors, Typography, Spacing, Border widths, Radius, Shadows, and
Documentation. Click a heading to scroll-jump straight to that section.

## How Tokens Work

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

Scamp organizes tokens into two conceptual layers:

- **Primitives** — raw values, like the ten shades of a color palette
  (`--color-brand-50` … `--color-brand-900`).
- **Semantic tokens** — meaningful roles that *point at* a primitive,
  like `--color-primary` → `--color-brand-500`. You style your design
  against semantic tokens, then re-point them later without touching
  a single element.

Tokens are routed to the right panel section, and to the right pickers
in the Properties panel, **by name** — `--color-*` are colors,
`--space-*` are spacing, `--text-<style>-*` are text styles, and so on.
You never tag a token's category yourself.

### Resolution on the canvas

Wherever an element uses `var(--color-primary)`, the canvas follows the
chain — semantic → primitive → hex — and paints the real color, so the
preview matches your deployed page. Change a token anywhere in the panel
and every element using it updates immediately, on the canvas and in the
generated CSS.

## Using Tokens in the Properties Panel

Once tokens exist, they surface as pickers throughout the Properties
panel. Each field shows only the tokens that fit it:

| Field | Token picker offers |
|---|---|
| Any color field | Color tokens (via the [Color Picker](color-picker.md) Tokens tab) |
| Font size | `--text-*` sizes and length tokens |
| Line height | Line-height tokens |
| Letter spacing | Length tokens |
| Font family | `--font-*` family tokens |
| Padding / margin / gap | `--space-*` spacing tokens |
| Border width | `--border-*` width tokens |
| Border radius | `--radius-*` radius tokens |
| Box shadow | `--shadow-*` presets |

Spacing, border, radius, and typography fields carry a small **token
icon** on the inside-right of the input. Click it for a dropdown of the
eligible tokens; the icon highlights in the accent color when the field
currently holds a token reference. You can still type literal values (or
mix them, like `16 var(--space-4)`) whenever you want.

To apply a whole **text style** at once, use the "Text style" dropdown
in the Typography section — see [Text Styles](text-styles.md).

## New Projects vs. Existing Projects

- **New projects** are scaffolded with a starter design system: five
  color palettes (Brand, Neutral, Error, Warning, Success), a set of
  semantic color tokens, and a default font. Spacing, radius, shadow,
  and text-style defaults are **added on demand** — each section has an
  "Add default …" button so your pickers stay uncluttered until you opt
  in. Everything is fully editable, so you can tweak the defaults or
  delete them and start fresh.
- **Existing projects** are left exactly as they are. Whatever tokens
  your `theme.css` already declares are preserved and shown; Scamp never
  restructures them for you.

## Editing theme.css by Hand

The panel is the primary author of `theme.css`, but it **respects
hand-written CSS**. Any rules, comments, or values you add to the file
directly are preserved when the panel rewrites the managed token blocks.
And because Scamp watches the file, edits made in your editor — or by an
AI agent — reload into the panel and canvas automatically. See
[Bidirectional Sync](bidirectional-sync.md).

> **Legacy projects:** projects created before the design system
> upgrade open the panel in a read-only state with a short migration
> notice, so their existing tokens are never accidentally rewritten.
