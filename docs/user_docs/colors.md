# Colors

The **Colors** section of the [Design System panel](design-system.md)
manages your project's color palettes and semantic color tokens. It has
two parts: **Primitives** (the raw palettes) and **Semantic** (the named
roles that point at them).

## Primitives — Color Palettes

A palette is a named ramp of ten shades, from `50` (lightest) to `900`
(darkest), written as `--color-<palette>-<shade>`. New projects ship
with five palettes: **Brand, Neutral, Error, Warning,** and **Success**.

Each palette block shows:

- An editable **name** field. Renaming a palette rewrites every
  `var(--…)` reference to its shades across your project so nothing
  dangles.
- A **swatch per shade**. Click any swatch to open the
  [Color Picker](color-picker.md) and set that shade's exact value.
- A **Generate** button.

### Generating a palette from a seed

Click **Generate** to build the whole ramp from the palette's `500`
shade. Scamp uses the [OKLCH color space](https://oklch.com) to produce
a perceptually even ramp — the shades step smoothly in lightness while
holding the hue, which looks far more natural than a naive lighten/darken.

The typical workflow:

1. Click the `500` swatch and set your brand color.
2. Click **Generate**.

The `500` shade is always anchored to exactly the color you picked, and
the other nine shades are re-derived around it. If you nudge `500` to a
different color and hit **Generate** again, the entire palette re-ramps
to match the new seed — it won't snap back to the old color.

The palette stays in its place in the list when you regenerate, so
there's no jarring jump.

## Semantic — Named Color Roles

Semantic tokens give your palette shades *meaning*. Instead of styling a
button with `--color-brand-500` directly, you style it with
`--color-primary`, which points at `--color-brand-500`. Later you can
re-point `--color-primary` to a different shade or palette and every
button follows — no element edits.

New projects include a set of semantic tokens such as `--color-primary`,
`--color-secondary`, `--color-background`, `--color-surface`,
`--color-text`, `--color-muted`, `--color-border`, plus `--color-error`,
`--color-warning`, and `--color-success`.

Each semantic row has:

- The token **name**.
- A **mapping dropdown** — grouped by palette — where you choose which
  primitive shade this role resolves to.
- A **resolved swatch** showing the actual color the mapping produces,
  so you can see the result at a glance.

Use **+ Add token** to create a custom semantic role.

### Broken references

If a semantic token points at a shade that no longer exists, its
resolved swatch shows a dashed, warning-colored outline so you can spot
and fix the dangling reference.

### Deleting a referenced palette

If you try to delete a palette that semantic tokens still point at,
Scamp warns you first — telling you how many semantic tokens would break
— so you can re-point them before removing the palette.

## Where colors show up

Every color token — primitive and semantic — appears in the **Tokens**
tab of the [Color Picker](color-picker.md) on any color field. Semantic
tokens resolve through the chain on the canvas, so what you see is the
final painted color. See [Design System](design-system.md) for the full
picture of how tokens resolve.
