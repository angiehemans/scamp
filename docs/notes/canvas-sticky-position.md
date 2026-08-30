# `position: sticky` renders at rest on the canvas

`elementToStyle` (`src/renderer/lib/elementToStyle.ts`) maps a typed
`position: sticky` to `auto` before building the canvas style. The
element is then placed by Scamp's normal tree-shape rules — `relative`
in a flex/grid parent, `absolute` with `left`/`top` from the stored x/y
anywhere else.

The generated CSS is untouched: `generateCode` still emits the real
`position: sticky`. This is a canvas affordance only, and it does not
touch the element model, so the round-trip invariant is unaffected.

## Why sticky can't be previewed here

A sticky element resolves against **its nearest scrolling ancestor**.
On the canvas that ancestor is the canvas viewport, not the page frame
the user is designing — the artboard itself is what pans and zooms. So
a genuine `position: sticky` on the canvas produces two wrong things at
once:

1. **It sticks to the artboard.** Pan the canvas and the element slides
   along with the viewport, detaching from the spot in the page where
   it actually lives. The user drags their navbar and it doesn't go
   where they put it.
2. **`top` / `left` change meaning.** For every other position value
   Scamp treats the stored x/y as coordinates. Under sticky the browser
   reads them as *stick offsets* — the distance the element holds from
   the scrollport edge once it engages. A rect stored at `y: 240` and
   rendered sticky sits 240px below the top of the canvas viewport, a
   place it never occupies in a real browser.

Rendering it at rest is the honest approximation: at scroll position
zero a sticky element is exactly a normal in-flow (or absolutely
placed) box, which is what the user is positioning. Scroll behaviour
is a runtime property of the finished page, not of the design surface —
the preview pane, which has a real page-shaped scroll container, is
where it can be seen working.

## Gotchas

- The mapping is deliberately applied to `left` and `top` as well as
  `position`. Mapping only the keyword would leave a sticky flex child
  with `left`/`top` offsets that its `relative` fallback then honours,
  nudging it off its layout slot.
- `-webkit-sticky` is rejected by `cssPropertyMap` and never reaches a
  typed `position` field, so it needs no case here.
- If the canvas ever gains a real page-shaped scroll container, this
  mapping should be deleted rather than adapted — the point is that the
  scroll container is wrong, not that sticky is unsupported.
