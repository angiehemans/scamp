---
title: The canvas tag reset must use :where, not :is
related:
  - src/renderer/src/canvas/ElementRenderer.module.css
  - src/renderer/lib/elementToStyle.ts
  - src/renderer/src/canvas/Viewport.tsx
---

# The canvas tag reset must use `:where`, not `:is`

`ElementRenderer.module.css` neutralises browser chrome on semantic tags so
a `button`-tagged rectangle looks like the box the user drew:

```css
.element:where(button, a, select, input, textarea, fieldset, legend) {
  all: unset;
  color: inherit;
  /* … */
}
```

It **must** be `:where`. With `:is`, the selector takes the specificity of
its most specific argument — a type selector — making it `(0,1,1)`. The
class rules the generator writes (`.hero_play_b209 { … }`) are `(0,1,0)`.
So `all: unset` won, and every page-authored property was silently
discarded for links, buttons and form tags on the canvas.

Verified in Electron's Chromium rather than reasoned about:

| Reset selector | page rule `color: rgb(0,255,0); font-size: 30px` |
|---|---|
| `.element:is(button, a)` | `rgb(1,2,3)` / `16px` — reset wins |
| `.element:where(button, a)` | `rgb(0,255,0)` / `30px` — page wins |

`:where` contributes zero specificity, so the reset fills in only what the
page does not set, and still beats the UA stylesheet (author origin always
does, at any specificity).

## Why it only surfaced recently

It was latent for as long as the canvas styled elements with **inline**
styles, which beat any stylesheet rule regardless of specificity. The
canvas/preview parity work peeled paint and typography out of the inline
layer and into the injected page stylesheet
(`docs/notes/canvas-inline-layer-peel.md`) — at which point those
properties dropped below the reset, but only for the seven tags it names.

The symptom was "I can't change the text colour on a link". It was not
just colour: `all: unset` outranked `font-size`, `font-weight`,
`letter-spacing` and everything else that had been peeled, for those tags
only.

## The general shape

Anything in the canvas's own chrome CSS that targets rendered elements is
competing with the user's generated CSS, and the user must win. Chrome
rules that fill in defaults belong in `:where(...)` at zero specificity.
Chrome rules that must override the page — the selection outline, the
text-edit affordance — need a deliberate specificity bump and a comment
saying so; those are already chained as `.element.selected` (0,2,0).
