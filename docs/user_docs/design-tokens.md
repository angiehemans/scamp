# Design Tokens — Spacing, Borders, Radius, Shadows

Beyond colors and type, the [Design System panel](design-system.md) has
four sections for the values that give your design its rhythm and depth:
**Spacing, Border widths, Radius,** and **Shadows**. Each works the same
way — a named scale you edit once and reuse everywhere.

These tokens are all lengths or shadow strings, so Scamp routes them to
the right section (and the right pickers) **by name**, not by value.

## Spacing

`--space-*` tokens define your spacing scale — the padding, margin, and
gap values used throughout a layout. A common scale runs `--space-1`
through `--space-16`.

Each row lets you edit the value, rename the label, or delete the token.
Spacing tokens surface in the padding, margin, and gap pickers across the
Properties panel.

## Border Widths

`--border-*` tokens define your border-width scale, typically **thin,
medium,** and **thick**. They surface in the border-width picker.

> Note: `--color-border` is a *color* token, not a border-width token —
> the prefix keeps them apart. Border **widths** are `--border-thin`,
> `--border-medium`, etc.

## Radius

`--radius-*` tokens define your corner-radius scale — for example
**none, sm, md, lg, xl, 2xl,** and **full**. Each row shows a small
**corner-preview swatch** so you can see the roundness at a glance. They
surface in the border-radius picker.

## Shadows

`--shadow-*` tokens define your elevation scale — for example **sm, md,
lg,** and **xl**. Each row uses a monospace input for the full
`box-shadow` value, and multi-layer shadows (comma-separated) round-trip
correctly.

Shadow tokens appear as a **preset dropdown** in the Properties panel's
Shadows section. Picking a preset applies that shadow's value to the
element — see below.

## Adding Defaults

To keep new projects lean, these tokens are **added on demand**. When a
section is empty you'll see:

- **+ Add default …** — adds the full recommended scale for that section.
- **+ Add token** — adds a single blank token to define yourself.

Once added, every token is fully editable — tweak the values, rename the
labels, or delete the ones you don't need.

## Using These Tokens

- **Spacing / border / radius fields** carry a token icon inside the
  input; click it for a dropdown of the matching tokens.
- **Shadow presets** apply from the "Shadow preset…" dropdown in the
  Shadows section of the Properties panel. Because Scamp stores shadows
  as structured, editable rows (not a `var()` reference), picking a
  preset is a one-time application: it fills in the shadow's layers,
  which you can then fine-tune per element.

See [Design System](design-system.md) for the full table of which token
types surface on which fields.
