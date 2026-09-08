# Transforms

The Transform section of the [properties panel](properties-panel.md)
applies CSS `transform` functions to an element—move, rotate, scale,
skew—without hand-written CSS. Transforms stack: each row is one
function, applied in order from top to bottom. None of them affect
layout; a translated element keeps its place in the flow and only draws
elsewhere.

## Add a transform

1. On the canvas, select an element.
2. Open the **Transform** section.
3. Click **+ Add transform**. A new row appears as a no-op translate
   (`0px, 0px`), so the element doesn't jump. Enter the values you want.

## Transform kinds

Each row has a kind list and the inputs that kind needs:

| Kind | Inputs | Maps to |
|---|---|---|
| **Translate** | X and Y offsets, as any CSS length: `10px`, `-50%`, `1rem`, or `var(--nudge)` | `translate(x, y)` |
| **Rotate** | An angle in degrees; negative for counterclockwise | `rotate(…deg)` |
| **Scale** | X and Y factors; `1` is unchanged, `0.5` is half, and `2` is double | `scale(x, y)` |
| **Skew** | X and Y angles in degrees | `skew(xdeg, ydeg)` |

Switching a row's kind resets its values to that kind's no-op; a 45°
rotation isn't a 45 px translate.

### Origin

Rotate, scale, and skew pivot around the transform origin, which
defaults to the element's center. The **Origin** row offers the nine
common positions as presets, and the text field beside it accepts any
CSS `transform-origin` value, such as `20px 40px` or `100% 0`. Translate
ignores the origin.

### Multiple transforms

Order matters: `rotate(45deg) translate(100px, 0)` moves along the
rotated axis, and `translate(100px, 0) rotate(45deg)` moves first and
then spins in place. Rows apply from top to bottom, matching the CSS
output.

To remove a transform, click the **×** on its row.

## Turn the group off

The eye icon in the section header comments the transform declarations
out in the generated CSS and hides them on the canvas. Use it to check
the untransformed layout without losing the values.

## Hover, active, and focus

Transforms are the classic hover effect. Select a state in the state
switcher and set a transform there—`scale(1.05)` on hover, for
example—and the section writes it inside the `:hover` block. Pair it
with a [transition](transitions.md) on `transform` for a smooth change.

## The generated CSS

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
axis-specific spellings (`translateX(-50%)`, `scaleY(0.5)`, and
`skewX(10deg)`), which appear on the two-axis rows and are written back
that way. Functions the section doesn't model—`matrix(…)`,
`translate3d(…)`, `rotate3d(…)`, `perspective(…)`, or an angle in
`turn`—still render on the canvas and are preserved exactly as written.
They appear under the CSS tab rather than in the rows.

## Related pages

- [Transitions](transitions.md): Animate the change.
- [Filters](filters.md): The other stacked-function section.
