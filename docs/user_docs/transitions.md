# Transitions

Add CSS transitions to any element from the
[properties panel](properties-panel.md), so that hover, active, and
focus changes animate smoothly. Transitions apply to whatever state
changes you define in [Element states](element-states.md)—no
JavaScript, media queries, or hand-written CSS required.

## Add a transition

1. Select an element. The **Transitions** section appears in the
   properties panel.
2. Click **+ Add transition**.

Each row has four controls:

| Control | What it does |
|---|---|
| **Property** | The CSS property to transition. Options: `all`, `opacity`, `transform`, `background`, `color`, `border`, `width`, and `height`. Default: `all`. |
| **Duration** | How long the transition takes. A number input with an ms/s unit toggle. Default: `200ms`. |
| **Easing** | The timing curve. Options: `ease`, `linear`, `ease-in`, `ease-out`, and `ease-in-out`, plus **Custom…** for `cubic-bezier(...)`. |
| **Delay** | How long to wait before the transition starts. A number input with an ms/s unit toggle. Default: `0ms`. |

To remove a row, click its **×** button. You can add as many rows as
you need; Scamp emits them as one comma-separated `transition`
shorthand.

## Custom easing

In the **Easing** list, select **Custom…** to open a four-point editor.
Type the four cubic-bezier control points—for example, `0.4, 0, 0.2, 1`
for Material's standard easing—and Scamp emits
`cubic-bezier(0.4, 0, 0.2, 1)` in your CSS. Hand-written
`cubic-bezier(...)` values in your file round-trip through the same
control.

## Where transitions appear

Transitions are static on the canvas; there's no animation player.
They animate in the following situations:

- A user hovers over, clicks, or focuses an element that has
  [state overrides](element-states.md). The transition smooths the
  property change between the default and the active state.
- A property updates programmatically, such as when a user types in an
  input or JavaScript toggles a class.
- You open [preview mode](preview.md). Transitions run in a real
  browser as expected.

## The generated CSS

Two transition rows on one element emit one shorthand:

```css
.rect_a1b2 {
  transition: opacity 200ms ease, transform 300ms ease-in-out 100ms;
}
```

Hand-written `transition` declarations in your CSS round-trip back into
the panel. Scamp recognizes both the shorthand and the longhand forms
(`transition-property`, `transition-duration`, and so on). See
[Bidirectional sync](bidirectional-sync.md).

## Tips

- Transitions live on the default styles. They apply to every state
  change automatically, which is how CSS transitions work.
- For the smoothest hover lifts, transition `transform` and `opacity`
  rather than `top` or `left`, because browsers can compose those on the
  GPU.
- To set up the hover, active, and focus styles that transitions animate
  to, see [Element states](element-states.md).
