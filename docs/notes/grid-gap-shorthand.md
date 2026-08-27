# `gap` on a grid was deleted on save

A grid container written with the `gap` shorthand lost its gap entirely
the next time Scamp wrote the file.

## The mechanism

Scamp has three gap fields: `gap` (flex-flavoured), `columnGap` and
`rowGap` (grid). The CSS `gap` shorthand sets **both axes**, but the
parser routed it to `gap` alone:

1. `gap: 20px` on a grid → `gap: 20`, `columnGap: 0`, `rowGap: 0`
2. The generator's grid branch emits `column-gap` / `row-gap` from those
   two fields, both at their default → **nothing emitted**
3. The declaration disappeared from the user's file

The canvas showed the same loss from the other direction: its grid branch
reads `columnGap` / `rowGap` and never `el.gap`, so the grid had no gap
there either. The parity harness caught the rendering half —
`cell.x` 480 on the canvas against 493.3 in the browser — and following it
back found the data loss.

Same shape as the `position: absolute` bug: a value the model couldn't
represent in the place the generator looked for it, so the round trip
quietly dropped it. see docs/notes/parse-position-absolute-in-flex.md

## The fix

- The `gap` mapping populates `gap`, `columnGap` and `rowGap`, matching
  what the CSS shorthand actually means.
- The generator's grid branch emits `gap: X` when the two axes are equal
  and the longhands only when they differ — so `gap: 20px` round-trips as
  written instead of being expanded.

The canvas needed no change: it already read `columnGap` / `rowGap`, and
those are now populated.

see docs/notes/parity-harness.md
