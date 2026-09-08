# Filters

The Filters section of the [properties panel](properties-panel.md)
applies CSS filter effects to an element without hand-written CSS:
blur, brightness, contrast, saturation, hue rotation, and more. Filters
stack: each row in the section is one filter function, applied in order
from top to bottom.

## Add a filter

1. On the canvas, select an element.
2. Open the **Filters** section.
3. Click **+ Add filter**. A new row appears with a modest blur, so you
   can see the effect immediately.

## Filter kinds

Each row has a kind list and a numeric value input. Select a kind, and
the unit changes automatically:

| Kind | Unit | Range | What it does |
|---|---|---|---|
| **Blur** | px | 0–100 | Gaussian blur; higher is blurrier |
| **Brightness** | % | 0–200 | 100% is unchanged; less than 100% is darker, more is brighter |
| **Contrast** | % | 0–200 | 100% is unchanged; 0% is flat gray; 200% is high contrast |
| **Grayscale** | % | 0–100 | Desaturates toward gray; 100% is fully gray |
| **Hue rotate** | deg | 0–360 | Rotates hues around the color wheel |
| **Invert** | % | 0–100 | Inverts colors; 100% is fully inverted |
| **Opacity** | % | 0–100 | CSS filter opacity, distinct from the element opacity property and applied as part of the filter chain |
| **Saturate** | % | 0–200 | 100% is unchanged; 0% is flat gray; 200% is supersaturated |
| **Sepia** | % | 0–100 | Sepia tone; 100% is fully sepia |

### Multiple filters

Stacking filters compounds them. Order matters: `blur(8px)
brightness(120%)` doesn't look the same as `brightness(120%) blur(8px)`.
Rows render top to bottom in the CSS output, so read the section from
the top down to predict the result.

To remove a filter, click the **×** on its row.

## Backdrop filter

A backdrop filter is a second filter chain that applies to the content
behind the element rather than to the element itself. It's most often
used for frosted-glass effects.

1. At the bottom of the section, turn on **Backdrop filter**.
2. Click **+ Add backdrop filter** to start a chain. The kinds are the
   same as for the main filter rows.

Backdrop filters have a visible effect only when the element has a
partially transparent background; otherwise, the element's own
background hides what would have been filtered. A reminder appears in
the section when backdrop is on.

## Tips

- A filter on a parent element affects all of its children:
  `filter: blur(4px)` on a card blurs its text and image together. To
  blur the layer behind an element instead, use a backdrop filter.
- The output CSS emits everything as a single space-separated `filter`
  declaration:
  ```css
  filter: blur(4px) brightness(120%) grayscale(20%);
  ```
- Removing the last row drops the `filter` declaration entirely; no
  `filter: none` is left behind.
- Filter chains round-trip through the parser. Edit them in your editor
  or with an AI agent, and the panel rebuilds the rows from the file.
  Anything Scamp doesn't model, such as `drop-shadow()` or
  `url(#svg-filter)`, survives exactly as written.

## Per-state and per-breakpoint filters

Filters honor the [state switcher](element-states.md) and
[breakpoints](breakpoints.md). Change the active state or breakpoint,
edit the Filters section, and the change lands in that scope's override
instead of the base CSS. A small blue dot appears next to the section
title when an override is active; right-click it to reset.
