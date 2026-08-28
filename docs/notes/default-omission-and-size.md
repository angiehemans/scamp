---
title: Why a fixed size is always emitted
related:
  - src/renderer/lib/generateCode/declarations.ts
  - src/renderer/lib/parseCode/index.ts
  - test/integration/sync.integration.test.ts
---

# Why a fixed size is always emitted

`generateCode` skips any property equal to its default, which keeps the
output clean. That rule is safe only when **absent and default mean the
same thing in CSS**. Absent `opacity` is `1`. Absent `width` is `auto`,
which is not `100px` — it is a different rendering entirely.

Size was going through the same skip, so an element with
`widthMode: 'fixed'` and the default `widthValue` of 100 emitted no width
at all:

```css
.rect_a1b2 { height: 150px; }              /* drawn 100 wide */
.rect_c3d4 { width: 180px; height: 150px; } /* drawn 180 wide */
```

Two failures came out of that one line.

**A rectangle drawn at exactly 100px wide lost its width.** In a flex
parent an element with no width is content-sized, so it collapsed. The
canvas still showed 100px, because the canvas renders from the model
rather than the file — so the canvas and the browser disagreed.

**It violated the round-trip invariant.** `parseCode` reads an absent
width as `auto`, not as fixed-at-the-default. So `fixed/100` went in and
`auto` came out. The invariant test carried a comment describing exactly
this and choosing non-default sizes to avoid it:

> The default widthValue/heightValue (100) round-trip via the generator as
> `auto` mode (no width/height declaration), so we pick non-default sizes
> here to lock in `fixed` mode.

The violation had been written into the test as expected behaviour, which
is how the invariant stayed green through a real break. The fixture now
includes an element at exactly the default size, and it fails against the
old generator.

## Why this cannot pin agent-written elements

The obvious worry: agent-written pages are full of elements with no
explicit width, and forcing a width would nail them all to 100px on the
next save.

It cannot happen. An absent width parses as `widthMode: 'auto'`, and only
`fixed` emits a length here. Verified rather than assumed:

| CSS | parsed |
|---|---|
| *(no width)* | `widthMode: 'auto'` |
| `width: 100px` | `widthMode: 'fixed'`, value 100 |

`fixed` at the default value only arises when the file actually said
`width: 100px`, or when a tool set it deliberately — which is what the
draw tool does.

## Fixture consequence

Two test fixtures built component instances from `DEFAULT_RECT_STYLES`,
which carries `widthMode: 'fixed'` at 100. Real instances come from
`makeComponentInstance`, which is `auto` on both axes — an instance has no
intrinsic size, the rendered component's root sets the box. Those fixtures
now match the factory. They were relying on "fixed 100 emits nothing" to
stand in for "auto emits nothing", which are different things that used to
look identical.
