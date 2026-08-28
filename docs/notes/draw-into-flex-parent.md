---
title: Drawing into a flex or grid parent
related:
  - src/renderer/lib/bounds.ts
  - src/renderer/src/canvas/interactions/useDrawInteraction.ts
---

# Drawing into a flex or grid parent

Drawing a rectangle inside a flex container produced a box with the drawn
height and a **20px width**.

## The cause

`clampToParent` keeps a child inside its parent by shrinking it:

```ts
if (nx + nw > parentW) {
  nw = Math.max(MIN_SIZE, parentW - nx);
}
```

That is right for an absolutely positioned child, where `x` is where the
element actually sits. It is wrong for a flex or grid child, whose
position is decided by the layout — the drawn offset is not where the
element ends up, it is just where the pointer happened to be.

So the width was being shrunk to `parentW - x`. Draw near the right of a
container and that goes negative, leaving `MIN_SIZE`, which is 20.

The height survived because the same arithmetic ran against a tall parent
with room to spare. That asymmetry is what made the bug look strange —
"correct height, absurd width" reads like a width-specific bug, when both
axes were running identical, correct-looking code.

## The fix

`clampSizeToParent` bounds the size to the parent without consulting the
offset. `useDrawInteraction` picks it when the parent's `display` is
`flex` or `grid`, and keeps `clampToParent` otherwise.

The size is still bounded by the parent, so a draw cannot instantly create
overflow. Only the offset-driven shrink is dropped.

`x` and `y` are set to 0 for a layout parent. The generator emits no
`left`/`top` for a flow child, so a kept offset would be discarded on the
next round-trip anyway — zeroing it keeps the in-memory model matching
what lands on disk.

## The second half: the render, not just the model

Fixing the clamp made the CSS correct and the canvas still wrong. A drawn
box reported `width: 180px` in the stylesheet and rendered at 148px,
because a flex item's default `flex-shrink: 1` squashes it below its own
width as soon as the line overflows. Both halves were behaving exactly as
CSS specifies; they simply disagreed about the answer.

The draw tool's promise is that you get the box you drew, so a drawn
element in a flex parent now gets `flex-shrink: 0` (`preserveDrawnSize` in
`src/renderer/lib/flexChild.ts`), applied to the rectangle, image, SVG and
input creators — everything that commits an exact drawn size. Text is left
alone: it hugs its content, and pinning it against shrinking changes how
it wraps, which is a different decision.

It goes through `customProperties` rather than a new typed field. That
means it is emitted verbatim into the generated CSS, so the preview and
any browser agree with the canvas; it round-trips through `parseCode` as
an unknown property with no new mapping and no risk to the round-trip
invariant; and it stays visible and removable in the CSS panel.

Grid parents are excluded — a grid item is sized by its track and already
honours an explicit width.

**The trade-off, stated plainly:** these boxes no longer participate in
flex shrinking, so they will not narrow when their container does. That is
the correct default for a drawing tool and the wrong default for a
responsive layout. Deleting the one line in the CSS panel restores normal
flex behaviour.

## Testing note

`test/e2e/canvas/draw-into-flex.spec.ts` covers both directions: a flex
parent keeps the drawn width, and a plain absolutely-positioned parent
still clamps. Two traps cost time writing it, both worth knowing for any
canvas spec:

- **The canvas renders unscaled and offset ~308px from the window's left
  edge**, so a frame-x much past 800 is outside the window and the mouse
  never lands. The drag silently does nothing and the failure looks like
  "no element was created".
- **A drawn width of exactly 100px is invisible in the CSS**, because 100
  is `DEFAULT_RECT_STYLES.widthValue` and the generator omits defaults.
  Assertions have to pick a number that is not a default, or they fail
  against correct behaviour.
- **Start the drag over empty space in the container.** Beginning it on
  top of a child resolves the insert parent to the root instead, and the
  spec then silently tests nothing — the CSS looks right because no flex
  parent was ever involved.
- **Assert the rendered box, not only the CSS.** Every CSS assertion in
  this spec passed while the canvas was visibly wrong. Only
  `getBoundingClientRect().width` caught it.
