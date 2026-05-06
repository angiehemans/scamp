# Transitions

Add CSS transitions to any element from the [Properties Panel](properties-panel.md) so hover, active, and focus changes animate smoothly. Transitions ride along with whatever state changes you've defined in the [Element States](element-states.md) panel — no JavaScript, no media queries, no hand-written CSS.

## Adding a Transition

Select any element. The **Transitions** section appears in the properties panel. Click **+ Add transition** to add a row. Each row has four controls:

| Control | What it does |
|---|---|
| **Property** | Which CSS property to transition. Dropdown: `all`, `opacity`, `transform`, `background`, `color`, `border`, `width`, `height`. Default `all`. |
| **Duration** | How long the transition takes. Number input + ms / s unit toggle. Default `200ms`. |
| **Easing** | The timing curve. Dropdown: `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`, plus a `Custom…` option for `cubic-bezier(...)`. |
| **Delay** | How long to wait before the transition starts. Number input + ms / s. Default `0ms`. |

Each row has a **×** button to remove it. You can stack as many rows as you need — they emit as a single comma-separated `transition` shorthand.

## Custom Easing

Pick **Custom…** in the Easing dropdown to open a four-point editor. Type the four cubic-bezier control points (e.g. `0.4, 0, 0.2, 1` for Material's standard easing) and Scamp emits `cubic-bezier(0.4, 0, 0.2, 1)` in your CSS. Hand-written `cubic-bezier(...)` values in your file round-trip through this same control.

## Where Transitions Show Up

Transitions are static on the canvas — there's no animation player here. They animate when:

- The user hovers, clicks, or focuses an element with [state overrides](element-states.md). The transition smooths the property change between Default and the active state.
- A property updates programmatically (typing in an input, JS toggling a class).
- You open [Preview mode](preview.md). Real React in a real browser, transitions fire as expected.

## What the Generated CSS Looks Like

Two transition rows on one element emit one shorthand:

```css
.rect_a1b2 {
  transition: opacity 200ms ease, transform 300ms ease-in-out 100ms;
}
```

Hand-written `transition` declarations in your CSS round-trip back into the panel — both shorthand and longhand (`transition-property`, `transition-duration`, etc.) forms are recognised. See [Bidirectional Sync](bidirectional-sync.md).

## Tips

- Transitions live on the **default** styles. They apply to every state change automatically — that's how CSS transitions work.
- For the smoothest feel on hover lifts, transition `transform` and `opacity` rather than `top`/`left` (browsers can compose those on the GPU).
- See [Element States](element-states.md) to wire up the hover / active / focus styles that transitions animate to.
