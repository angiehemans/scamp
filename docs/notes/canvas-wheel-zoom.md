# Canvas wheel / trackpad zoom

`Viewport.tsx` registers a **non-passive** `wheel` listener on the artboard
scroll container (`scrollContainerRef`). Non-passive is required so the
handler can `preventDefault()` — otherwise the browser applies its own
ctrl-wheel page zoom / pinch zoom and scroll.

## Which gestures we consume

Both map to the same continuous-zoom path; plain scroll is left untouched:

- **Trackpad pinch** → `wheel` with `e.ctrlKey === true` (the browser
  synthesizes `ctrlKey` for pinch), small `deltaY`.
- **Cmd/Ctrl + mouse wheel** → `wheel` with `e.ctrlKey` / `e.metaKey` true,
  larger notched `deltaY`.

The delta → scale mapping (`nextZoomFromWheel`, exponential, clamped to
`[MIN_ZOOM, MAX_ZOOM]`) lives in `@lib/zoom` so it stays unit-testable.

### Platform note: trackpad pinch on Linux

Two-finger pinch/expand is delivered to web content as a `ctrlKey` wheel
event by Chromium on **macOS** (and Windows precision touchpads), so it flows
through the same handler. On **Linux**, Chromium/Electron does not surface
libinput pinch gestures to the renderer as wheel events, so pinch cannot be
captured here — this is an upstream gap, not something the handler can fix.
**Ctrl + two-finger scroll** produces a real `ctrlKey` wheel event and works
on every platform, and is the Linux fallback.

## Cursor anchoring

The frame is `transform: scale(scale)` from `transform-origin: top left`, and
the artboard owns scrolling. To keep the point under the pointer fixed across
a zoom step we:

1. On the wheel event, record the pointer's **logical** (pre-scale) position
   inside the frame: `logical = (clientX − frameRect.left) / oldScale`.
2. Change the zoom (`setZoom(next)`), which re-renders with the new
   transform.
3. In a `useLayoutEffect` keyed on the committed `scale` (so it runs after
   the new transform is in the DOM but before paint), shift the scroll by
   `logical · (next − old)` on each axis.

Derivation: the frame's client-left changes by `−Δscroll` when we scroll, and
we want `frameLeft' + logical·next === clientX` given `frameLeft + logical·old
=== clientX`, so `Δscroll = logical·(next − old)`.

Caveat: this assumes the frame's centering margin within the scroll content
doesn't change across the step. That holds while the content already
overflows (margin 0). Near the fit boundary the anchor can be off by the
margin delta — acceptable, since at that zoom there's little/no scroll to
correct anyway.
