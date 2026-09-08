# Flex layout

Flexbox is Scamp's default layout engine for a row of cards, a navbar,
or a column of form fields. The **Layout** section of the
[properties panel](properties-panel.md) exposes the whole flex
vocabulary on the container, and the **Size** section adds flex-child
controls on anything placed inside one. Everything maps to the real CSS
property, so hand-written flex CSS round-trips back into the panel.

## Turn a container into a flex box

1. Select a rectangle.
2. In the **Layout** section, click **Flex row** or **Flex column**.

The **Reverse** toggle, on its own row below Wrap, turns the direction
into `row-reverse` or `column-reverse`, so children run from the end.
It's a toggle rather than two more direction buttons because reverse is
a modifier on an axis you've already chosen.

## Flex container controls

| Control | What it accepts | Maps to |
|---|---|---|
| **Flex row / Flex column** | Segmented control. | `display: flex` and `flex-direction` |
| **Reverse** | Toggle. | `flex-direction: row-reverse` or `column-reverse` |
| **Alignment grid** | Click a cell to pack children to that corner, edge, or the center. Double-click for space-between. | `align-items` and `justify-content` |
| **Align** | Start, Center, End, Stretch, or Baseline. | `align-items` |
| **Justify** | Start, Center, End, Between, Around, or Evenly. | `justify-content` |
| **Gap** | A number in pixels, or a spacing token. | `gap` |
| **Wrap** | No wrap, Wrap, or Wrap reverse. | `flex-wrap` |
| **Align content** | Start, Center, End, Between, Around, Evenly, or Stretch. Appears with Wrap. | `align-content` |
| **Row gap / Column gap** | A number or token each. Appear with Wrap, or whenever the file already sets one. | `row-gap` and `column-gap` |

Two things to know about the gaps:

- **Row gap is always vertical**, and column gap is always horizontal,
  no matter which direction the flex runs. That's how CSS defines them.
- When you first edit one of the pair on an element that only had
  **Gap**, Scamp copies the gap into both axes before applying your
  change, so the other axis keeps the value you were looking at.

Under **Reverse**, the alignment grid still maps by axis: the left
column means `flex-start`, which the browser now draws on the right. The
tooltips say Start and End rather than Left and Right so this reads
correctly.

## Flex child controls

Select an element whose parent is a flex container, and the Size section
gains an **Advanced** disclosure. Open it for the flex-child controls.
It stays open while you move between siblings.

| Control | What it accepts | Maps to |
|---|---|---|
| **Grow** | A number of 0 or more. The share of leftover space this child takes. | `flex-grow` |
| **Shrink** | A number of 0 or more. How readily the child gives up space when the line overflows. | `flex-shrink` |
| **Don't shrink** | Toggle. The same as Shrink = 0. | `flex-shrink: 0` |
| **Basis** | Free text: `auto`, `200px`, `0%`, or `var(--card-w)`. | `flex-basis` |
| **Align self** | Auto, Start, Center, End, Stretch, or Baseline. Auto follows the parent's Align. | `align-self` |
| **Order** | An integer; negatives are allowed. Lower comes first. | `order` |

### Why Don't shrink is often already on

Flex children shrink by default. A 180 px box in an overfull row renders
narrower than 180 px, which is correct CSS but surprising in a drawing
tool. So Scamp keeps the size you gave it:

- Drawing a box into a flex container turns **Don't shrink** on.
- Typing a pixel size into the child's main axis (width in a row, height
  in a column) turns it on too.
- Switching that axis to **Fill**, **Hug**, or **Auto** turns it off
  again.

Clear it whenever you want a responsive box that gives way to its
siblings. Scamp only ever clears a guard it set itself; a Shrink value
you typed by hand, such as `0.5`, is left alone.

### Fill, and the one shorthand Scamp writes

Setting a child's height to **Fill** inside a flex column writes
`flex: 1`, which is the CSS that fills there, because `height: 100%`
collapses against an auto-height parent. That's the only time Scamp
writes the `flex` shorthand, and reading it back maps to Fill, not to
Grow. Everything you set in the flex-child block is written as
longhands: `flex-grow`, `flex-shrink`, and `flex-basis`.

## The generated CSS

A wrapping card row with a fixed-width, non-shrinking child:

```css
.cards_a1b2 {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  row-gap: 24px;
  column-gap: 16px;
}

.card_c3d4 {
  width: 320px;
  flex-shrink: 0;
}

.spacer_e5f6 {
  flex-grow: 1;
  order: -1;
}
```

Hand-written flex CSS round-trips back through the panel, including the
`flex` shorthand (`flex: 1 1 200px`, `flex: none`, and `flex: auto` all
expand into the three fields) and both spellings of `align-self`
(`flex-start` and `start`).

## Tips

- For a responsive card grid, turn on **Wrap**, set a **Row gap**, and
  give each card a pixel **Basis** with **Grow** set to 1. Cards fill
  each line and break onto the next as the container narrows.
- **Align content** appears only with Wrap on, because with a single
  line it does nothing.
- Use [breakpoints](breakpoints.md) to turn **Wrap** on only below a
  certain width, or to flip a row into a column on mobile.
- Use [grid](grid-layout.md) when you need rows and columns to line up;
  flex with Wrap is enough for most galleries.
