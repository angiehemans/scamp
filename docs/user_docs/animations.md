# Animations

Apply CSS keyframe animations to any element from a curated preset
library. Scamp writes the `animation` shorthand on your element's class
and the matching `@keyframes` block at the bottom of the CSS module—no
hand-written keyframes required.

## Add an animation

1. Select an element. The **Animation** section appears in the
   [properties panel](properties-panel.md).
2. Click the picker to open a searchable list grouped by category, and
   then select a preset.

### The preset library

**Entrances**
- `fade-in`: Opacity 0 to 1
- `fade-in-up`: Fade plus a rise from below
- `fade-in-down`: Fade plus a drop from above
- `slide-in-left`: Translate from the left edge
- `slide-in-right`: Translate from the right edge
- `scale-in`: Scale from 0.95 and fade up to full size
- `bounce-in`: Scale overshoot on entry

**Exits**
- `fade-out`: Opacity 1 to 0
- `fade-out-up`: Fade plus a rise out
- `slide-out-left`: Translate to the left edge
- `slide-out-right`: Translate to the right edge
- `scale-out`: Scale and fade down

**Attention**
- `pulse`: Scale 1 to 1.05 to 1, looping
- `shake`: Rapid horizontal oscillation
- `bounce`: Vertical bounce loop
- `spin`: Full rotation loop
- `ping`: Scale and opacity pulse, for notification dots

**Subtle**
- `float`: Gentle vertical drift, looping
- `wiggle`: Subtle rotational oscillation

When you select a preset, Scamp fills the animation controls with
sensible defaults and writes the `animation` shorthand to your element's
class. Scamp appends the matching `@keyframes` block to the bottom of the
CSS module if it isn't there already—one copy per file, regardless of
how many elements use it.

## Animation controls

After you apply a preset, fine-tune it with these controls, which appear
in pairs in the panel:

| Control | What it does | Default |
|---|---|---|
| **Duration** | How long one cycle takes. A number input with an ms/s unit toggle. | `300ms` |
| **Easing** | The timing curve: `ease`, `linear`, `ease-in`, `ease-out`, or `ease-in-out`. | `ease` |
| **Delay** | How long to wait before the animation starts. A number input with an ms/s unit toggle. | `0ms` |
| **Iteration** | How many times to play. A number input with a list to switch to **Infinite** (∞). | `1` |
| **Direction** | `normal`, `reverse`, `alternate`, or `alternate-reverse`. | `normal` |
| **Fill mode** | Which styles apply before and after the animation runs: `none`, `forwards`, `backwards`, or `both`. | `forwards` |
| **Play state** | A Running/Paused toggle. Useful for prototyping a paused-state mockup. | `running` |

## Canvas preview

The **▶ Play** button in the Animation section runs the animation once
on the canvas, so you can preview the motion without switching to
[preview mode](preview.md). Animations don't loop on the canvas while
you edit; that would be distracting while you lay out a page.

For looping animations (`pulse`, `spin`, `float`, and so on), the play
button shows one cycle. Open the preview to see the looping behavior in
real time.

## The generated CSS

A card with a `fade-in-up` entrance:

```css
.feature_card_c001 {
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

`@keyframes` blocks live at the bottom of the file, after the per-element
class blocks. Multiple elements that use the same preset share one
`@keyframes` block; Scamp deduplicates by name.

## Per-state animations

You can apply different animations per [element state](element-states.md).
In the state switcher, select **Hover**, select an animation from the
preset list, and Scamp emits the following:

```css
.icon_button_b001:hover {
  animation: shake 250ms ease;
}
```

A `shake` on hover or a `pulse` on focus works well for attention-getting
micro-interactions tied to user input.

## Custom keyframes

The picker covers the curated preset library. If you or an AI agent
hand-writes a `@keyframes` block in your CSS file, it round-trips through
Scamp unchanged: the block stays in the file, and any element with
`animation: <your-name> ...` continues to work. The picker doesn't
include your custom name in the list.

A custom keyframes editor is on the backlog.

## Reduced motion

For accessibility, consider wrapping animation declarations in
`@media (prefers-reduced-motion: no-preference)`, so that users with
vestibular sensitivities don't get motion they didn't ask for. Scamp
preserves these media queries exactly as written in your CSS; write
them by hand in the CSS mode of the [properties panel](properties-panel.md).

## Tips

- For an attention loop on a notification dot, use `ping`. It's a
  subtle pulse that doesn't distract.
- Pair entrance animations (`fade-in-up` and `scale-in`) with the
  `forwards` fill mode, so the element stays in its final state after
  the animation completes.
- Long-running loops (`spin` and `float`) on multiple elements add up to
  noticeable battery drain on mobile. Keep them sparse.
- For the simpler smooth-state-change version, see
  [Transitions](transitions.md); for hover, active, and focus styling,
  see [Element states](element-states.md).
