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
