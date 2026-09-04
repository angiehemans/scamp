# Flex Layout

Flexbox is Scamp's default layout engine — a row of cards, a navbar, a
column of form fields. The **Layout** section of the [Properties
Panel](properties-panel.md) exposes the whole flex vocabulary on the
container, and the **Size** section adds flex-child controls on anything
placed inside one. Everything maps to the real CSS property, so
hand-written flex CSS round-trips back into the panel.

## Turning a Container Into a Flex Box

Select a rectangle. In the **Layout** section pick **Flex row** or **Flex
column**. The **Reverse** toggle, on its own row below Wrap, turns that
into `row-reverse` / `column-reverse` — children run from the end. It's
a toggle rather than two more direction buttons because reverse is a
modifier on an axis you've already chosen.

## Flex Container Controls

| Control | What it accepts | Maps to |
|---|---|---|
| **Flex row / Flex column** | Segmented. | `display: flex` + `flex-direction` |
| **Reverse** | Toggle. | `flex-direction: row-reverse` / `column-reverse` |
| **Alignment grid** | Click a cell to pack children to that corner, edge, or the centre. Double-click for space-between. | `align-items` + `justify-content` |
| **Align** | Start / Center / End / Stretch / Baseline. | `align-items` |
| **Justify** | Start / Center / End / Between / Around / Evenly. | `justify-content` |
| **Gap** | Number (px) or a spacing token. | `gap` |
| **Wrap** | No wrap / Wrap / Wrap reverse. | `flex-wrap` |
| **Align content** | Start / Center / End / Between / Around / Evenly / Stretch. Appears with Wrap. | `align-content` |
| **Row gap / Column gap** | Number or token each. Appear with Wrap, or whenever the file already sets one. | `row-gap` / `column-gap` |

Two things about the gaps:

- **Row gap is always vertical** and column gap always horizontal, no
  matter which direction the flex runs — that's how CSS defines them.
- When you first edit one of the pair on an element that only had
  **Gap**, Scamp copies the gap into both axes before applying your
  change, so the other axis keeps the value you were looking at.

Under **Reverse**, the alignment grid still maps by *axis*: the left
column means `flex-start`, which the browser now draws on the right. The
tooltips say Start / End rather than Left / Right so this reads
correctly.

## Flex Child Controls

Select an element whose **parent** is a flex container and the Size
section gains an **Advanced** disclosure. Open it for the flex-child
controls (it stays open while you move between siblings):

| Control | What it accepts | Maps to |
|---|---|---|
| **Grow** | Number ≥ 0. Share of leftover space this child takes. | `flex-grow` |
| **Shrink** | Number ≥ 0. How readily it gives up space when the line overflows. | `flex-shrink` |
| **Don't shrink** | Toggle. The same thing as Shrink = 0. | `flex-shrink: 0` |
| **Basis** | Free-text: `auto`, `200px`, `0%`, `var(--card-w)`. | `flex-basis` |
| **Align self** | Auto / Start / Center / End / Stretch / Baseline. Auto follows the parent's Align. | `align-self` |
| **Order** | Integer, negatives allowed. Lower comes first. | `order` |

### Don't shrink, and why it's often already on

Flex children shrink by default. A 180px box in an over-full row renders
narrower than 180px — correct CSS, surprising in a drawing tool. So Scamp
keeps the size you gave it:

- **Drawing** a box into a flex container turns **Don't shrink** on.
- **Typing a px size** into the child's main axis (width in a row, height
  in a column) turns it on too.
- Switching that axis to **Fill**, **Hug**, or **Auto** turns it off
  again.

Untick it whenever you want a responsive box that gives way to its
siblings. Scamp only ever clears a guard it set itself — a Shrink value
you typed by hand (say `0.5`) is left alone.

### Fill, and the one shorthand Scamp writes

Setting a child's height to **Fill** inside a flex *column* writes
`flex: 1` — the CSS that actually fills there, since `height: 100%`
collapses against an auto-height parent. That is the only time Scamp
writes the `flex` shorthand, and reading it back maps to Fill, not to
Grow. Everything you set in the flex-child block is written as
longhands (`flex-grow`, `flex-shrink`, `flex-basis`).

## What the Generated CSS Looks Like

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

Hand-written flex CSS rounds-trip back through the panel, including the
`flex` shorthand (`flex: 1 1 200px`, `flex: none`, `flex: auto` are all
expanded into the three fields) and both spellings of `align-self`
(`flex-start` and `start`).

## Tips

- For a responsive card grid, use **Wrap** with a **Row gap**, and give
  each card a px **Basis** with **Grow** 1 — cards fill each line and
  break onto the next as the container narrows.
- **Align content** only shows with Wrap on, because with a single line
  it does nothing.
- Use [Breakpoints](breakpoints.md) to switch **Wrap** on only below a
  certain width, or to flip a row into a column on mobile.
- Reach for [Grid](grid-layout.md) when you genuinely need rows *and*
  columns to line up; flex with Wrap is enough for most galleries.
