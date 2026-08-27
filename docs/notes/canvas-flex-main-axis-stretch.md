# Canvas main-axis stretch: `width: 100%`, never `flex: 1`

`elementToStyle` (`src/renderer/lib/elementToStyle.ts`) turns a
stretch-width/height flex child into inline styles for the canvas DOM.
For the **main** axis it used to substitute `flex: 1` and drop the size.
That is not what the generated CSS says, and the difference is visible.

## The bug

`flex: 1` is shorthand for `flex: 1 1 0%` — **flex-basis zero**.
`width: 100%` on a flex item is basis *100%*. The two agree only when the
item is alone in its parent. Once it has a sized sibling they diverge:

- basis 100% → the item shrinks *proportionally alongside* the sibling
- basis 0 → the item can only grow into whatever the sibling leaves

Found in the `design-podcast` project. A hero laid out as

```css
.hero        { display: flex; justify-content: center; }
.hero_glow   { width: 980px; height: 820px; /* decorative, in flow */ }
.hero_inner  { width: 100%; max-width: 1160px; }
```

measured at a 1440px viewport:

| | inner width | inner left | glow width |
|---|---|---|---|
| browser / preview (`width: 100%`) | 804px | 604 | 573 |
| canvas (`flex: 1`) | **396px** | **1012** | **981** |

On the canvas the hero content was squeezed to half width and pushed
hard right, while the preview looked fine — a direct violation of
"the canvas mirrors the browser".

## The fix

Keep the `100%` the generator wrote and add `min-width: 0` (or
`min-height: 0`) so the item can still shrink past its content, which is
what a flex item does. No `flex` shorthand.

`instanceStretch.ts` mirrors this branch for the canvas-only wrapper
around a component instance, so the two must change together — otherwise
an instance and a plain stretch rectangle in the same slot lay out
differently.

## Why the canvas can just say what the CSS says

The canvas *is* a browser. Every substitution is a chance to diverge, so
the default should be to emit the generated declaration verbatim and only
deviate where a canvas-only structural difference forces it (the instance
wrapper, the root's min-height floor). The cross-axis case in
[canvas-cross-axis-stretch.md](canvas-cross-axis-stretch.md) is the one
genuine exception: a row parent's `height: 100%` collapses against an
indefinite container height, so it falls back to `align-self: stretch`.

## Related

A decorative element like `.hero_glow` above should be
`position: absolute`, not an in-flow flex item — in flow it consumes real
main-axis space in the browser too. See the layout rules in the generated
`agent.md` for the guidance agents get on this.
