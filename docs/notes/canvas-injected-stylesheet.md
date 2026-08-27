# The canvas loads the page's own stylesheet

`CanvasPageStylesheet` in `Viewport.tsx` mounts a `<style>` inside the
canvas frame containing the CSS `generateCode` would write to disk,
wrapped in `@scope`.

## Why

The canvas translates the element model into inline React styles. Two
consequences, both bad:

- every property is an independent chance to translate wrongly, which is
  where the parity bugs kept coming from
- some CSS has **no inline form at all**, so it never rendered —
  `::before` / `::after`, `:nth-child`, and any hand-written selector
  were parsed, preserved, written back to the file, and invisible on the
  canvas

The second is unfixable by improving the translator. The generated
stylesheet is the thing the preview already renders, so the canvas loads
it too.

## Additive, for now

Inline styles beat any selector, so this changes nothing about the
properties `elementToStyle` already sets — it only supplies what the
translation could never express. That makes this step safe to land on its
own: the parity harness went from one known gap to none, with no other
fixture moving.

Later phases move properties out of the inline layer so these rules take
over. Each removal is verifiable: if the stylesheet doesn't say the same
thing the inline style did, the harness fails.

## `@scope`, and its one wrinkle

`@scope ([data-scamp-canvas]) { … }` keeps the page's rules off Scamp's
own UI. A descendant prefix (`#canvas .rect_a1b2`) would work too but adds
specificity, and a rule that outranks its counterpart in the preview is a
new way to diverge.

`@scope` is not entirely cascade-neutral either: **scope proximity is
considered before source order**, so a scoped rule beats an unscoped one
of equal specificity regardless of position. Verified in Electron 31
(Chromium 126), along with `@scope` support itself and the fact that
scoped rules don't leak outside the frame. It only matters for rules
outside this sheet targeting the same page classes, which nothing does.

## Media queries are excluded, and this is the interesting one

A media query is evaluated against the **document viewport** — here, the
Electron window — while Scamp's breakpoints size the canvas *frame*. Set
the artboard to 390px in a maximised window and a `max-width: 700px` rule
does not fire; narrow the window on a 1440px artboard and it does. Both
are wrong, and neither has anything to do with the design.

The breakpoint cascade is already resolved against the frame width and
applied inline, which is the correct semantics, so stripping these loses
nothing that worked. What it does cost is breakpoint-specific rules that
inline styles cannot express — a `::before` inside a media query still
won't render on the canvas.

Fixing that properly needs the frame to actually BE a viewport, which
means an iframe, or `@container` queries with the frame as the container
(and the generated CSS is written with `@media`, not `@container`, so
that would be a translation — the thing this whole effort is trying to
stop doing).

This is the strongest argument yet for the iframe end-state the parity
plan lists as option 3.

## Keyframes are excluded

`CanvasKeyframes` already injects them, and a non-style at-rule inside
`@scope` has no defined meaning — a browser that rejects it could drop
the entire scoped block and take every page rule with it. `stripKeyframes`
removes them before wrapping.

## Page elements carry their page class; instance internals carry a prefixed one

The page's `ElementRenderer` path appends `classNameFor(element)` to the
node's class list alongside Scamp's own canvas classes, so the injected
rules have something to match.

Instance internals cannot use the bare name. Inside an instance those are
the COMPONENT's class names, and both a component root and a page root
are called `root` — so a page `.root` rule would reach in and repaint it.
That was measured: a 120x60 card rendered 120x813, wearing the page
root's 40px padding and its `min-height: 100vh`.

So instance internals carry `inst_a024__root`, and the stylesheet carries
a matching prefixed copy of the component's rules — the same
`prefixCss` + `collectExpandedInstances` transform the HTML exporter
uses, so the two can't disagree about what a prefix looks like. This is
CSS Modules' job, done by hand for a canvas that has no module loader.

### `instanceId` is not the instance's class

`renderComponentSubtree` already threaded an `instanceId` for prop-edit
keying, and it is the raw canvas id (`a024`) — while `classNameFor` on an
instance yields `inst_a024`. Prefixing with the former produced
`a024__root` against a stylesheet saying `.inst_a024__root`, and nothing
matched. The instance's class is now threaded separately and explicitly,
because the two strings look similar enough to be confused again.

### Nested instances

They render as a placeholder on the canvas rather than being expanded, so
prefixes are only ever one level deep. `collectExpandedInstances` still
emits rules for nested ones; they simply go unused.

see docs/plans/canvas-preview-parity-plan.md

## Why the inline layer cannot be peeled back yet

The point of injecting the stylesheet is eventually to stop translating:
remove a property from `elementToStyle` and let the sheet supply it. That
is blocked, and by the same limitation as `@media` above.

The canvas resolves each element at the **active breakpoint**
(`resolveElementAtBreakpoint`) and renders the result inline. The injected
sheet has its `@media` blocks stripped, so it only ever carries the
desktop base. Remove `box-shadow` from the inline layer and a
breakpoint-specific shadow disappears from the canvas, because the only
thing that knew about it was the inline value.

So every property that can be breakpoint-overridden — which is most of
them — has to stay inline until the frame can evaluate media queries
itself. That means the iframe.

The order in the parity plan therefore wants revisiting: the iframe is
listed as an alternative scoping option, but it is really the
prerequisite for phase 3 rather than a nicety. Nothing meaningful can be
peeled without it.
