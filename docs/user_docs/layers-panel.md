# Layers Panel

The layers panel is in the left sidebar. It displays your element tree -- every element on the current page, organized by nesting depth.

## Viewing the Tree

Elements are listed top-to-bottom matching their order in the generated code. Nested elements appear indented under their parents.

## Selecting Elements

- **Click** an element to select it. The element highlights on the canvas and its properties appear in the [Properties Panel](properties-panel.md).
- **Shift-click** to select multiple elements.

## Reordering

Drag and drop elements within the layers panel to change their order or nesting. Dropping an element onto another makes it a child of that element.

## Renaming

Double-click an element's name to rename it. See [Element Naming](element-naming.md) for details on how names map to CSS classes.

## Tooltips

Hover over any element in the layers panel to see a tooltip with its CSS class name (e.g. `hero_card_a1b2`). This is useful for finding the right class when editing CSS externally.

## Tips

- Use the layers panel to select elements that are hard to click on the canvas, such as elements hidden behind others.
- The tree updates in real time as you add, remove, or reorder elements.
