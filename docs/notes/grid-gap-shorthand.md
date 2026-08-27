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

## The fix, and the wrong first attempt

The first attempt had the parser populate all three fields from the
shorthand. It fixed the data loss and **broke the round-trip invariant**:
a flex element parsed to `gap` + `columnGap` + `rowGap` where the original
had only `gap`, so `parseCode(generateCode(x)) !== x`.

It also collapsed equal axes into `gap` on the way out, which loses which
field the value came from — `column-gap: 20px; row-gap: 20px` came back as
`gap: 20px` and reparsed into different fields. Two round-trip hazards in
one change.

The fix is in the generator instead, and each field emits from its own
source:

- the `gap` mapping sets only `gap`, as it always did
- the grid branch emits `gap` from `el.gap`, **and** `column-gap` /
  `row-gap` from their own fields

A grid written with the shorthand therefore keeps it, a grid written with
longhands keeps those, and both round-trip. `gap` is valid CSS on a grid
and means the same thing, so emitting it there is not a workaround.

The canvas needs no change at all now: the injected stylesheet carries
whichever spelling the file used.

## How it went unnoticed

`npm run test:unit` excludes the integration tests, and the round-trip
invariant lives in `test/integration/sync.integration.test.ts`. Run the
bare `npx vitest run` (2678 tests) before trusting a parser or generator
change — `test:unit` alone is 2403 and will not tell you the invariant
broke.

see docs/notes/parity-harness.md
