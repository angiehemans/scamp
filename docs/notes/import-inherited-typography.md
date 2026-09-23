# Why the importer re-inherits typography

## The rule that collides

Two reasonable rules, one on each side of the importer, cancel each
other out:

- **The capture drops a property that inheritance already supplies.**
  `captureScript.ts` skips any property in `INHERITED_PROPERTIES`
  whose computed value matches the parent's. A page that sets its font
  once on `<body>` therefore records it once, on the root, and nowhere
  else. That is what keeps a real page's capture payload small.

- **Scamp emits typography only on text elements.**
  `generateCode/declarations.ts` guards the whole typography block with
  `if (el.type === 'text')`. A rectangle holds a `fontFamily` in the
  model, but the generator never writes it, so it never reaches the
  stylesheet.

Put together: the font lands on a container, the container never
declares it, and every text element below it — each of which had its
own copy dropped as redundant — renders in the browser default.

## What it looked like

Not like a missing font. Like bad layout.

`system-ui` is wider than most of what a real page ships. A label
measured at 129.484px wide needed 136.38px once it fell back, so it
wrapped, and a one-line label became two. On scamp.club that happened
to 100 of 101 text elements, and the extra line pushed through every
ancestor: 49 boxes were a line or more too tall, and headings ran into
the text under them.

The fidelity harness read 78%, and every single offender was
height-only and taller than its source — which is the signature of this
bug, and worth remembering as one. Nothing pointed at fonts until
`getComputedStyle` on a rendered import said `system-ui`.

## The fix

`resolveInheritance` in `importReduce.ts` walks the captured tree
carrying the inherited properties down, and fills in any an element
does not declare for itself — but only on text elements, where Scamp
can actually emit them. Containers stay clean.

Two ordering constraints:

- It runs **before** `collapse`. A wrapper whose only contribution is a
  font is exactly the kind of node the collapse pass removes, and it
  would take the font with it.
- It runs on the **narrower breakpoint captures too**
  (`applyBreakpointCaptures`). That diff compares normalised base
  styles against normalised narrow styles; resolving one side and not
  the other makes the asymmetry look like a media query.

## The general lesson

The harness compares boxes, and a font substitution is not a box
problem until it becomes one. When offenders are uniformly *taller*
and never wider, check what typeface actually rendered before
theorising about layout.

See also `docs/notes/parity-harness.md` — the oracle has to be set up
the way the real thing is, which is why the harness loads the project's
`theme.css` and a Google Fonts link.

## Two more things the same investigation turned up

**A lifted text child had no styles at all.** When a node holds both
bare text and element children, the reducer lifts the text into a
`<span>` of its own, because Scamp does not allow loose words in a
container. That span was built with an empty declaration list, so it
fell to `DEFAULT_RECT_STYLES` — a 100×100 box in the browser's default
face, shouldering the real content aside. It now takes its parent's
inherited typography and an auto box.

**Grid templates are read back as used values.** `getComputedStyle`
reports `grid-template-columns: 1fr 1fr` as
`548.094px 495.891px`, and `auto` rows as whatever height the content
took. Declaring the rows stops the content from ever growing, which is
how a grid ends up with its text spilling out of it. `normalizeGridTracks`
drops a row template that is only measurements, and turns column
tracks back into fractions when they fill the content box — tracks that
leave room were really written in pixels and are kept.

Dropping the row template *lowered* the harness score, from 86% to
83% on one page, and that is the right trade: a pinned box measures
exactly right while its content pours out of it. The overflow count is
the honest number for this class of change, which is why the harness
reports it.

## Recovering `::before` and `::after`

A page's ticks and toggles live in pseudo-elements: nine `"✓"` bullets
and nine `"+"` FAQ markers on one site. Scamp has no pseudo-elements,
so the import used to report them as losses and hand back a design with
its punctuation missing.

The capture now records a pseudo whose `content` is a plain string —
its text and its own filtered styles — and `materializePseudos` turns
each into a real text element. That is the better answer than
supporting pseudo-elements would have been: the glyph shows up in the
layers panel and can be edited. `content: url(…)`, `counter(…)` and
`attr(…)` are still reported, because they are generated from state the
model cannot hold.

Three things this needed that were not obvious:

**Insets read back as used values.** The custom-bullet idiom is
`position: absolute; left: 0`, and Chromium reports `right: 251.656px;
bottom: 21.6875px` alongside it — the leftover space, not a decision.
Nothing distinguishes an authored inset from a resolved one, so the
capture keeps the inset nearer its edge on each axis: in this idiom the
authored value is the small or zero one.

**The host's own words have to move.** A recovered `::before` must
render in front of the text it belongs to, and it cannot if that text
stays on the host. `materializePseudos` lifts the host's text (or its
inline run) into a sibling so the order is
`[::before, the words, children, ::after]`.

**The host then needs a layout.** A host with children and no layout
display pins every child at 0,0, printing the glyph on top of the
words. The pass sets one itself, and the direction follows the glyph: a
glyph taken out of flow leaves the words stacking as block flow did, a
glyph still in flow sits beside them on a baseline. An earlier attempt
widened `flowLayoutFor` instead, which caught 24 spans that had never
held text and turned them into flex columns — the rule has to name the
case it is for.

## The list-padding bug this uncovered

With the bullets recovered, every imported `<li>` measured 40px narrower
than its source and wrapped a line early. The cause was not the import:
`BROWSER_RESET_BLOCK` zeroes the UA margin on every block-level tag so
the canvas and the export agree, but the UA also sets `ul, ol, menu {
padding-inline-start: 40px }`, and that was missed. Any `ul`-tagged
element in Scamp was 40px narrower than the canvas drew it and than the
properties panel said — the panel reported padding 0 throughout.

Fixed in three places, because all three have to agree: the canvas
reset, `DEFAULT_THEME_CSS`, and a fifth backfill check in
`themeBackfill`. The backfill needs its own sentinel: a project created
before this already carries the browser-reset sentinel, so folding the
rule into that block would never have reached one.
