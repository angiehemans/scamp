# Transforms

The Transform section in the [Properties Panel](properties-panel.md)
applies CSS `transform` functions to an element — move, rotate, scale,
skew — without writing CSS by hand. Transforms stack: each row is one
function, applied in order from top to bottom, and none of them affect
layout — a translated element keeps its place in the flow and only
*draws* elsewhere.

## Adding a Transform

1. Select an element on the canvas.
2. Open the **Transform** section.
3. Click **+ Add transform**. A new row appears as a no-op translate
   (`0px, 0px`) so the element doesn't jump; dial in the values you
   want.

## Transform Kinds

Each row has a kind dropdown and the inputs that kind needs:

| Kind | Inputs | Maps to |
|---|---|---|
| **Translate** | X and Y offsets — any CSS length: `10px`, `-50%`, `1rem`, `var(--nudge)` | `translate(x, y)` |
| **Rotate** | Angle in degrees, negative for counter-clockwise | `rotate(…deg)` |
| **Scale** | X and Y factors; `1` is unchanged, `0.5` is half, `2` is double | `scale(x, y)` |
| **Skew** | X and Y angles in degrees | `skew(xdeg, ydeg)` |

Switching a row's kind resets its values to that kind's no-op — a 45°
rotation is not a 45px translate.

### Origin

Rotate, scale and skew pivot around the **transform origin**, which
defaults to the element's centre. The **Origin** row offers the nine
common positions as presets, and the text field beside it takes any
CSS `transform-origin` value (`20px 40px`, `100% 0`). Translate ignores
the origin.

### Multiple transforms

Order matters: `rotate(45deg) translate(100px, 0)` moves along the
rotated axis, `translate(100px, 0) rotate(45deg)` moves first and then
spins in place. Rows apply top-to-bottom, matching the CSS output.

To remove a transform, click the **×** on its row.

## Turning the Group Off

The eye icon in the section header comments the transform declarations
out in the generated CSS and hides them on the canvas — useful for
checking the untransformed layout without losing the values.

## Hover, Active, Focus

Transforms are the classic hover effect. Pick a state in the State
Switcher and set a transform there — `scale(1.05)` on hover, say — and
the section writes it inside the `:hover` block. Pair it with a
[Transition](transitions.md) on `transform` for a smooth change.

## What the Generated CSS Looks Like

```css
.badge_a1b2 {
  transform: translate(-50%, -50%) rotate(-12deg);
  transform-origin: top left;
}

.card_c3d4:hover {
  transform: scale(1.05);
}
```

Hand-written transforms round-trip into the section, including the
axis-specific spellings (`translateX(-50%)`, `scaleY(0.5)`, `skewX(10deg)`),
which are shown on the two-axis rows and written back that way.
Functions the section doesn't model — `matrix(…)`, `translate3d(…)`,
`rotate3d(…)`, `perspective(…)`, or an angle in `turn` — still render on
the canvas and are preserved exactly as written; they show under the
CSS tab rather than in the rows.

## Related

- [Transitions](transitions.md) — animate the change
- [Filters](filters.md) — the other stacked-function section
