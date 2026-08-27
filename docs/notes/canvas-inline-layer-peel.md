# Peeling the canvas's inline style layer

The canvas translated the element model into inline React styles. Every
property was an independent chance to translate wrongly, and that is
where the parity bugs came from — `flex: 1` for `width: 100%`,
`align-items: flex-start` against CSS's `stretch`, a gradient on
`background-color`.

Now that the canvas also loads the generated stylesheet, each property in
that inline layer is redundant: the sheet already says the same thing.
Removing one lets the sheet take over, and the parity harness proves the
two agreed.

## Order matters, and paint went first

Paint properties — `box-shadow`, `filter`, `backdrop-filter`,
`mix-blend-mode`, `background-blend-mode` — are the safest to remove:
pure paint, no layout impact, no canvas-only affordance attached.

They were also, until recently, the *least* verifiable: they produce
identical geometry, so a geometry-only harness cannot see them. That is
why pixel comparison was built before this step rather than after, and
why the paint fixture covers exactly these properties.

## Why this is now safe for breakpoints too

An inline value beats any stylesheet rule, so while a property stayed
inline it masked its own breakpoint override. Peeling it lets the
`@container` rules in the sheet win — see
[canvas-injected-stylesheet.md](canvas-injected-stylesheet.md). Before
container queries the sheet had no breakpoint rules at all, which is why
this step was blocked.

## What must NOT be peeled

Canvas-only affordances, which the preview has no counterpart for and the
sheet therefore never contains:

- the root's min-height floor, so a blank page has a canvas to draw on
- the component-instance wrapper's sizing
- transient values applied during a drag or resize

Each is a deliberate difference from the preview. The test for whether
something belongs in the inline layer is simple: would the preview show
it? If yes, the sheet already has it and the inline copy is redundant.

## Typography needed a third comparison mode

Type is invisible to geometry — it produces no box of its own — and
unreliable in pixels, because the two Chromium builds resolve fonts
differently. Neither existing mode could see it.

So the harness gained a computed-style comparison: read
`getComputedStyle` for a named set of properties on both sides and diff
the values. `font-family` reports the specified stack rather than the
matched font, sizes come back in px and colours in `rgb(...)`, so the
question asked is "did the rule apply", which is exactly what a peel needs
to know, and not "were the glyphs rasterised identically".

The typography fixture was checked green BEFORE the peel, so the peel is
measured against a known-good baseline rather than a hope.

One fixture trap on the way: an element with no explicit `line-height`
takes it from the matched font, so its height differed between engines by
2.5px. That is the same font-resolution artefact as the earlier 3.2px
width, wearing different clothes. Typography fixtures must pin
`line-height` for the same reason they must not measure intrinsic width.

## Doing the next group

Remove it, run the parity harness, and check both geometry and paint. If
a fixture does not cover the property, add one first — a peel verified by
a harness that cannot see the property is not verified at all.
