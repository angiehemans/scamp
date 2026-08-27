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

## Keyframes are excluded

`CanvasKeyframes` already injects them, and a non-style at-rule inside
`@scope` has no defined meaning — a browser that rejects it could drop
the entire scoped block and take every page rule with it. `stripKeyframes`
removes them before wrapping.

## Elements carry their page class

Both `ElementRenderer` render paths now append `classNameFor(element)` to
the node's class list alongside Scamp's own canvas classes, so the
injected rules have something to match.

see docs/plans/canvas-preview-parity-plan.md
