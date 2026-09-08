# Grid layout

CSS Grid lets you build two-dimensional layouts—cards in a three-column
row, dashboards with a header, sidebar, and main area, image
galleries—without writing CSS by hand. The Layout section of the
[properties panel](properties-panel.md) supports Grid alongside Flex,
with grid-item placement controls on direct children.

## Turn a container into a grid

1. Select a rectangle element.
2. In the **Layout** section, select **Grid**.

The display control has four options:

- **Block**: Block layout. Children are positioned absolutely.
- **Flex row** and **Flex column**: One-dimensional flex layout. See
  [Flex layout](flex-layout.md).
- **Grid**: CSS Grid.

Selecting **Grid** swaps the Flex controls for the Grid controls.

## Grid container controls

| Control | What it accepts | Maps to |
|---|---|---|
| **Columns** | Free text: any valid `grid-template-columns` value, such as `1fr 1fr`, `repeat(3, 1fr)`, `200px 1fr`, or `repeat(auto-fill, minmax(200px, 1fr))` | `grid-template-columns` |
| **Rows** | Free text: any valid `grid-template-rows` value | `grid-template-rows` |
| **Column gap** | A number input, in px | `column-gap` |
| **Row gap** | A number input, in px | `row-gap` |
| **Align items** | Start, Center, End, or Stretch | `align-items` |
| **Justify items** | Start, Center, End, or Stretch | `justify-items` |

The **Columns** and **Rows** fields are free text because Grid's syntax
is too rich for a click-only UI: `minmax`, `auto-fill`, `auto-fit`,
named line references, and explicit pixel sizes all work.

## Grid item controls

When you select an element whose parent is a grid container, additional
controls appear in the Size section:

| Control | What it accepts | Maps to |
|---|---|---|
| **Col** (column span) | Free text: `span 2`, `1 / 3`, or `main-start / main-end` | `grid-column` |
| **Row** (row span) | Free text, in the same forms as **Col** | `grid-row` |
| **Align self** | Auto, Start, Center, End, Stretch, or Baseline | `align-self` |
| **Justify self** | Start, Center, End, or Stretch | `justify-self` |

Children with no **Col** or **Row** value flow with auto-placement: the
browser fills empty grid cells in source order.

## The grid overlay

When a grid container is selected, Scamp draws a dashed overlay on the
canvas that shows every column and row line. The overlay updates live as
you change the **Columns**, **Rows**, and gap values, so you can see
exactly how the engine lays out cells before you place children.

## The generated CSS

A three-column card row with a 24 px gap:

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

Hand-written grid CSS round-trips back through the panel. Scamp
recognizes the full set of grid properties: `display: grid`,
`grid-template-columns`, `grid-template-rows`, `column-gap`, `row-gap`,
`grid-column`, `grid-row`, `align-items`, `justify-items`, `align-self`,
and `justify-self`.

## Auto-placement

You don't have to place every child explicitly. With
`grid-template-columns: repeat(3, 1fr)` and four children, the browser
places the first three in row 1 and the fourth in row 2, column 1. Scamp
doesn't override this; auto-placement is plain CSS.

## Tips

- For responsive card grids, try `repeat(auto-fill, minmax(240px, 1fr))`.
  Children wrap to a new row whenever the container can't fit another
  240 px column.
- The **Align self** and **Justify self** controls appear only when the
  parent is a grid. In flex parents, see the flex-child controls in
  [Flex layout](flex-layout.md).
- Use [breakpoints](breakpoints.md) to switch from a multi-column grid to
  a single column on mobile: at the mobile breakpoint, change
  **Columns** to `1fr`.
- You can also drag and resize grid items by hand, but most of the time
  `grid-column` and `grid-row` are what you want.
