# Colors

The **Colors** section of the [Design System panel](design-system.md)
manages your project's color palettes and semantic color tokens. It has
two parts: **Primitives** (the raw palettes) and **Semantic** (the named
roles that point at them).

## Primitives: color palettes

A palette is a named ramp of ten shades, from `50` (lightest) to `900`
(darkest), written as `--color-<palette>-<shade>`. New projects ship
with five palettes: **Brand**, **Neutral**, **Error**, **Warning**, and
**Success**.

Each palette block shows the following:

- An editable **name** field. Renaming a palette rewrites every
  `var(--…)` reference to its shades across your project, so nothing is
  left dangling.
- A **swatch per shade**. Click any swatch to open the
  [color picker](color-picker.md) and set that shade's exact value.
- A **Generate** button.

### Generate a palette from a seed

Click **Generate** to build the whole ramp from the palette's `500`
shade. Scamp uses the [OKLCH color space](https://oklch.com) to produce
a perceptually even ramp: the shades step smoothly in lightness while
holding the hue, which looks far more natural than a naive
lighten-and-darken.

The typical workflow:

1. Click the `500` swatch and set your brand color.
2. Click **Generate**.

The `500` shade is always anchored to exactly the color you picked, and
the other nine shades are re-derived around it. If you change `500` to a
different color and click **Generate** again, the entire palette re-ramps
to match the new seed; it doesn't snap back to the old color.

The palette stays in its place in the list when you regenerate, so
nothing jumps.

## Semantic: named color roles

Semantic tokens give your palette shades meaning. Instead of styling a
button with `--color-brand-500` directly, you style it with
`--color-primary`, which points at `--color-brand-500`. Later, you can
re-point `--color-primary` to a different shade or palette, and every
button follows, with no element edits.

New projects include a set of semantic tokens such as `--color-primary`,
`--color-secondary`, `--color-background`, `--color-surface`,
`--color-text`, `--color-muted`, and `--color-border`, plus
`--color-error`, `--color-warning`, and `--color-success`.

Each semantic row has the following:

- The token **name**.
- A **color control**, the same one the properties panel uses, where you
  set what the role resolves to.
- A **resolved swatch** that shows the actual color, so you can see the
  result at a glance.

To create a custom semantic role, click **+ Add token**.

### Three ways to set a semantic token

The color control offers all three:

- **Map it to a primitive.** On the **Tokens** tab, select a shade. This
  is the norm, and the tab the row opens on.
- **Type a literal value.** Enter a hex value or any CSS color in the
  row's own field. Useful for a one-off that doesn't belong in a palette.
- **Use the picker.** Click the swatch for the full picker, including the
  eyedropper and presets.

The picker offers primitives only. A semantic token can't point at
another semantic token, which would make a reference cycle easy to create
by accident.

### Broken references

If a semantic token points at a shade that no longer exists, its resolved
swatch shows a dashed, warning-colored outline, so you can spot and fix
the dangling reference.

### Delete a referenced palette

If you try to delete a palette that semantic tokens still point at, Scamp
warns you first and tells you how many semantic tokens would break, so
you can re-point them before you remove the palette.

## Where colors appear

Every color token, primitive and semantic, appears in the **Tokens** tab
of the [color picker](color-picker.md) on any color field. Semantic
tokens resolve through the chain on the canvas, so what you see is the
final painted color. For the full picture of how tokens resolve, see
[Design system](design-system.md).
