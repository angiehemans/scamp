# Layers Panel

The layers panel is in the left sidebar. It displays your element tree -- every element on the current page, organized by nesting depth.

## Viewing the Tree

Elements are listed top-to-bottom matching their order in the generated code. Nested elements appear indented under their parents.

## Selecting Elements

- **Click** an element to select it. The element highlights on the canvas and its properties appear in the [Properties Panel](properties-panel.md).
- **Shift-click** to select multiple elements.

## Reordering

Drag and drop elements within the layers panel to change their order or nesting. Where you release decides what happens:

- **Over the middle of a row** — the row highlights, and the element becomes a child of it.
- **Near the top or bottom edge of a row** — an indented line appears, and the element drops beside it as a sibling. The line's indent shows which level it will join.

Rows that can't hold children — text, images, inputs, and component instances — never highlight; dropping on them always places the element beside them.

The canvas follows the same rule: the middle of a container nests inside it, its edges drop alongside it. While you drag, the container the element will end up in is outlined, so you can see where it will live before you let go — this works the same in flex and grid layouts. Press **Escape** during a drag to cancel it — the element returns to where it started.

## Renaming

Double-click an element's name to rename it. See [Element Naming](element-naming.md) for details on how names map to CSS classes.

## Tooltips

Hover over any element in the layers panel to see a tooltip with its CSS class name (e.g. `hero_card_a1b2`). This is useful for finding the right class when editing CSS externally.

## Tips

- Use the layers panel to select elements that are hard to click on the canvas, such as elements hidden behind others.
- The tree updates in real time as you add, remove, or reorder elements.
