# `position: absolute` on a flex child was deleted on save

`applyDeclarations` (`src/renderer/lib/parseCode/apply.ts`) skipped
`position: absolute` **unconditionally**, leaving the typed field as the
`auto` sentinel.

## Why the skip existed

`auto` means "let Scamp's tree-shape rules pick". For a child of a
NON-layout parent those rules emit `position: absolute` — so when the
file already says `absolute`, not pinning it keeps the element adaptive
and the round-trip text-stable. That reasoning is sound, and only there.

## The bug

Inside a **flex or grid** parent, `auto` means "in flow" — Scamp emits no
`position` at all. So for a flex child the skip threw the value away:

1. An agent (or the user) writes `position: absolute` on a decorative
   layer inside a flex row.
2. `parseCode` reads it as `auto`.
3. `generateCode` emits the class **without** `position`.
4. The next save rewrites the user's file, silently deleting the
   declaration — and the layer drops back into flow, consuming main-axis
   space and shoving the real content sideways in the browser as well as
   on the canvas.

This violated the round-trip invariant, and it made the failure
self-healing in the wrong direction: fixing the CSS by hand worked until
Scamp next saved, then reverted.

Found on the `design-podcast` hero, whose decorative glow could not be
made absolute because Scamp kept removing the declaration.

## The fix

Skip only when Scamp would have auto-emitted the value — i.e. when the
parent is not a flex/grid container. `parseCode` builds a class→
declarations lookup and passes `parentIsLayoutContainer` into
`applyDeclarations`.

The `relative` branch beside it was already conditioned this way (root
only); `absolute` simply never got the equivalent guard.

## Related

The canvas separately forced flex children to `position: relative`, which
would have masked a correct model anyway — see
[canvas-flex-main-axis-stretch.md](canvas-flex-main-axis-stretch.md) for
the sibling bug, and the parity plan for why re-deriving styles keeps
producing this class of defect.
