# Canvas extent oscillation

The canvas sizes itself from its own contents, and the result feeds back into the measurement. That loop is fine as long as every step is stable, but two things made it oscillate forever — visible as the canvas jittering continuously after placing an element exactly as wide as the frame (a component instance whose root is `width: 100%` is the easy way to hit it).

## The loop

```
measureFrame()  →  content.right  →  fitWidth  →  fitScale  →  scale
      ↑                                                          ↓
      └──────  container clientWidth  ←  scrollbar  ←  shellWidth/Height
```

`Viewport` measures the rightmost/bottommost rendered edge, feeds it into fit-to-width zoom, and multiplies the result back into the `frameShell` size — which is what makes the artboard scroll.

## Two fixes, both needed

**1. Sub-pixel wobble in the measurement.** `measureFrame` computes the extent as `(rect.right - frameRect.left) / appliedScale`. At a fractional zoom, an element exactly as wide as the frame lands a hair either side of it, and `Math.round` turned that into `frameW` on one pass and `frameW + 1` on the next. Since `fitWidth = Math.max(frameW, content.right)`, that 1px flip changes the zoom.

`settleExtent` (`lib/canvasOverflow.ts`) snaps anything within `CONTENT_EXTENT_TOLERANCE_PX` of the frame box onto the frame box exactly. Real overflow (beyond the tolerance) rounds up, so the boundary indicator never under-reports. `measureFrame` also bails out of `setContent` when the value is unchanged — the extent drives the zoom, so a no-op re-render is a full lap around the sizing loop.

The same trap is documented for the component-canvas hug in `component-canvas-sizing-plan.md`, which is why `measureContentSize` uses `offsetLeft/offsetWidth` chains instead of dividing client rects by the scale.

**2. The scrollbar.** `.artboardScroll` was `overflow: auto` with no reserved gutter. A vertical scrollbar appearing shrinks `clientWidth`, which shrinks `fitScale`, which shrinks `shellHeight`, which removes the scrollbar, which grows `clientWidth` — forever. `scrollbar-gutter: stable` takes the scrollbar out of the loop entirely.

Fix 1 stops the canvas from entering the oscillation; fix 2 stops it from being able to sustain one. Anything that later derives layout from `clientWidth` on a scroll container whose contents it also sizes needs the same gutter treatment.
