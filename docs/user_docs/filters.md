# Filters

The Filters section in the [Properties Panel](properties-panel.md)
lets you apply CSS filter effects to an element without writing
CSS by hand — blur, brightness, contrast, saturation, hue rotation,
and more. Filters stack: each row in the section is one filter
function, applied in order from top to bottom.

## Adding a Filter

1. Select an element on the canvas.
2. Open the **Filters** section.
3. Click **+ Add filter**. A new row appears, defaulted to a
   modest blur so you can see the effect immediately.

## Filter Kinds

Each row has a kind dropdown and a numeric value input. Pick a
kind and the unit changes automatically:

| Kind | Unit | Range | What it does |
|---|---|---|---|
| **Blur** | px | 0–100 | Gaussian blur — higher = blurrier |
| **Brightness** | % | 0–200 | 100% = unchanged; <100% darker, >100% brighter |
| **Contrast** | % | 0–200 | 100% = unchanged; 0% flat grey; 200% high-contrast |
| **Grayscale** | % | 0–100 | Desaturate towards grey; 100% = fully grey |
| **Hue rotate** | deg | 0–360 | Rotate hues around the color wheel |
| **Invert** | % | 0–100 | Invert colors; 100% = fully inverted |
| **Opacity** | % | 0–100 | CSS filter opacity (distinct from the element opacity property — applied as part of the filter chain) |
| **Saturate** | % | 0–200 | 100% = unchanged; 0% flat grey; 200% supersaturated |
| **Sepia** | % | 0–100 | Sepia tone; 100% = fully sepia |

### Multiple filters

Stacking filters compounds them. Order matters — `blur(8px)
brightness(120%)` is not visually the same as `brightness(120%)
blur(8px)`. Rows render top-to-bottom in the CSS output, so
read the section from top down to predict the result.

To remove a filter, click the **×** on its row.

## Backdrop Filter

A second filter chain that applies to the content **behind** the
element rather than to the element itself. Most commonly used for
"frosted glass" effects.

1. Toggle **Backdrop filter** on at the bottom of the section.
2. **+ Add backdrop filter** to start a chain. Same kind list as
   the main filter row above.
3. Backdrop filters only have a visible effect when the element
   has a partially transparent background — otherwise the
   element's own background obscures what would have been
   filtered.

A reminder hint appears in the section when backdrop is enabled.

## Tips

- Filter on a parent element affects **all of its children** —
  `filter: blur(4px)` on a card blurs its text and image
  together. Use `backdrop-filter` for "blur the layer behind"
  instead.
- The output CSS emits everything as a single space-joined
  `filter:` declaration:
  ```css
  filter: blur(4px) brightness(120%) grayscale(20%);
  ```
- Removing the last row drops the `filter` declaration entirely
  (no `filter: none` left behind).
- Filter chains round-trip through `parseCode`: edit them in
  your editor or via an AI agent and the panel rebuilds the
  rows from the file. Anything Scamp doesn't model — like
  `drop-shadow()` or `url(#svg-filter)` — survives verbatim
  through the `customProperties` passthrough.

## Per-state and per-breakpoint filters

Filters honour the [State Switcher](element-states.md) and
[Breakpoints](breakpoints.md): change the active state or
breakpoint, edit the Filters section, and the change lands in
that scope's override instead of the base CSS. A small blue dot
appears next to the section title when an override is active —
right-click to reset.
