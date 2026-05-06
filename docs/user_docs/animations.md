# Animations

Apply CSS keyframe animations to any element from a curated preset library. Scamp writes the `animation` shorthand on your element's class and the matching `@keyframes` block at the bottom of the CSS module — no hand-written keyframes, no copy-paste from Stack Overflow.

## Adding an Animation

Select any element. The **Animation** section appears in the [Properties Panel](properties-panel.md). Click the picker dropdown to open a searchable list grouped by category.

### Preset Library

**Entrances**
- `fade-in` — opacity 0 → 1
- `fade-in-up` — fade plus rise from below
- `fade-in-down` — fade plus drop from above
- `slide-in-left` — translate from left edge
- `slide-in-right` — translate from right edge
- `scale-in` — scale 0.95 + fade up to full size
- `bounce-in` — scale overshoot on entry

**Exits**
- `fade-out` — opacity 1 → 0
- `fade-out-up` — fade plus rise out
- `slide-out-left` — translate to left edge
- `slide-out-right` — translate to right edge
- `scale-out` — scale + fade down

**Attention**
- `pulse` — scale 1 → 1.05 → 1, loops
- `shake` — rapid horizontal oscillation
- `bounce` — vertical bounce loop
- `spin` — full rotation loop
- `ping` — scale + opacity pulse for notification dots

**Subtle**
- `float` — gentle vertical drift, loops
- `wiggle` — subtle rotational oscillation

Pick a preset and Scamp populates the animation property controls with sensible defaults and writes the `animation` shorthand to your element's class. The matching `@keyframes` block is appended to the bottom of the CSS module if it isn't already there — one copy per file regardless of how many elements use it.

## Animation Property Controls

Once a preset is applied, fine-tune with these controls (paired side-by-side in the panel):

| Control | What it does | Default |
|---|---|---|
| **Duration** | How long one cycle takes. Number input + ms / s. | `300ms` |
| **Easing** | The timing curve. Dropdown: `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`. | `ease` |
| **Delay** | Wait before the animation starts. Number input + ms / s. | `0ms` |
| **Iteration** | Number of times to play. Number input with a dropdown caret to switch to **Infinite** (∞). | `1` |
| **Direction** | Dropdown: `normal`, `reverse`, `alternate`, `alternate-reverse`. | `normal` |
| **Fill mode** | What styles apply before / after the animation runs. Dropdown: `none`, `forwards`, `backwards`, `both`. | `forwards` |
| **Play state** | Toggle: Running / Paused. Useful for prototyping a paused-state mockup. | `running` |

## Canvas Preview

A **▶ Play** button in the Animation section triggers the animation once on the canvas, so you can preview the motion without switching to [Preview mode](preview.md). Animations don't loop on the canvas during editing — that would be distracting while you're laying out a page.

For continuously-looping animations (`pulse`, `spin`, `float`, etc.), the play button shows one cycle. Open Preview to see the looping behaviour in real time.

## What the Generated CSS Looks Like

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

`@keyframes` blocks live at the bottom of the file, after the per-element class blocks. Multiple elements using the same preset share one `@keyframes` block — Scamp deduplicates by name.

## Per-State Animations

You can apply different animations per [element state](element-states.md). Switch to **Hover** in the State Switcher, pick an animation from the preset dropdown, and Scamp emits:

```css
.icon_button_b001:hover {
  animation: shake 250ms ease;
}
```

A `shake` on hover, a `pulse` on focus — useful for attention-grabbing micro-interactions tied to user input.

## Custom Keyframes

The picker covers the curated preset library. If you (or an AI agent) hand-write a `@keyframes` block in your CSS file, it round-trips through Scamp unchanged — the block stays in the file and any element with `animation: <your-name> ...` continues to work. The picker just doesn't include your custom name in the dropdown.

A first-class custom keyframes editor is on the backlog.

## Reduced Motion

For accessibility, consider wrapping animation declarations in `@media (prefers-reduced-motion: no-preference)` so users with vestibular sensitivities aren't hit with motion they didn't ask for. Scamp preserves these media queries verbatim in your CSS — write them by hand in CSS mode of the [Properties Panel](properties-panel.md).

## Tips

- For attention loops on a notification dot, use `ping` — it's a subtle pulse that doesn't distract.
- Pair entrance animations (`fade-in-up`, `scale-in`) with `forwards` fill mode so the element stays in its final state after the animation completes.
- Long-running loops (`spin`, `float`) on multiple elements add up to noticeable battery drain on mobile — keep them sparse.
- See [Transitions](transitions.md) for the simpler "smooth state change" version, and [Element States](element-states.md) for hover / active / focus styling.
