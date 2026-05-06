# Grid Layout

CSS Grid lets you build complex two-dimensional layouts — cards in a 3-column row, dashboards with header / sidebar / main, image galleries — without writing CSS by hand. Scamp's Layout section in the [Properties Panel](properties-panel.md) supports Grid alongside Flex, with grid-item placement controls on direct children.

## Turning a Container Into a Grid

Select any rectangle element. In the **Layout** section, the Display control has three options:

- **None** — block layout. Children are positioned absolutely.
- **Flex** — flex layout (one-dimensional, see Flex docs in the [Properties Panel](properties-panel.md)).
- **Grid** — CSS Grid.

Pick **Grid** and the panel swaps the Flex controls for Grid controls.

## Grid Container Controls

| Control | What it accepts | Maps to |
|---|---|---|
| **Columns** | Free-text. Any valid `grid-template-columns` value: `1fr 1fr`, `repeat(3, 1fr)`, `200px 1fr`, `repeat(auto-fill, minmax(200px, 1fr))`. | `grid-template-columns` |
| **Rows** | Free-text. Any valid `grid-template-rows` value. | `grid-template-rows` |
| **Column gap** | Number input (px). | `column-gap` |
| **Row gap** | Number input (px). | `row-gap` |
| **Align items** | Segmented: Start / Center / End / Stretch. | `align-items` |
| **Justify items** | Segmented: Start / Center / End / Stretch. | `justify-items` |

The Columns and Rows fields are free-text because Grid's syntax is too rich for a click-only UI — `minmax`, `auto-fill`, `auto-fit`, named line refs, and explicit pixel sizes all work.

## Grid Item Controls

When you select an element whose **parent** is a grid container, additional controls appear in the Size section:

| Control | What it accepts | Maps to |
|---|---|---|
| **Col** (Column span) | Free-text. `span 2`, `1 / 3`, `main-start / main-end`. | `grid-column` |
| **Row** (Row span) | Free-text. Same forms as Column. | `grid-row` |
| **Align self** | Segmented: Start / Center / End / Stretch. | `align-self` |
| **Justify self** | Segmented: Start / Center / End / Stretch. | `justify-self` |

Children with no Col / Row value flow with auto-placement (the browser fills empty grid cells in source order).

## The Grid Overlay

When a grid container is selected, Scamp draws a subtle dashed overlay on the canvas showing every column and row line. The overlay updates live as you change the Columns / Rows / gap values, so you can see exactly how the engine is laying out cells before you place children.

## What the Generated CSS Looks Like

A 3-column card row with 24px gap:

```css
.cards_g100 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 24px;
  row-gap: 24px;
}

.featured_card_f200 {
  grid-column: span 2;
}
```

Hand-written grid CSS rounds-trip back through the panel — Scamp recognises the full set of grid properties (`display: grid`, `grid-template-columns`, `grid-template-rows`, `column-gap`, `row-gap`, `grid-column`, `grid-row`, `align-items`, `justify-items`, `align-self`, `justify-self`).

## Auto-Placement

You don't have to place every child explicitly. With `grid-template-columns: repeat(3, 1fr)` and four children, the browser places the first three in row 1 and the fourth in row 2 column 1. Scamp doesn't override this — auto-placement is just CSS.

## Tips

- For responsive card grids, try `repeat(auto-fill, minmax(240px, 1fr))` — children wrap to a new row whenever the container can't fit another 240px column.
- The Align Self / Justify Self controls only appear when the parent is grid — in flex parents, the equivalent is on the parent (`align-items` / `justify-content`).
- Use [Breakpoints](breakpoints.md) to switch from a multi-column grid to a single column on mobile: at the mobile breakpoint, change `grid-template-columns` to `1fr`.
- Grid items can also be resized and laid out by hand (drag, resize) but most of the time `grid-column` / `grid-row` is what you want.
