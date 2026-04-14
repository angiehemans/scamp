# Element Naming

Every element in Scamp has a name that maps to its CSS class in the generated code.

## Default Names

- Rectangles are named `rect_` followed by a short ID (e.g. `rect_a1b2`).
- Text elements are named `text_` followed by a short ID (e.g. `text_c3d4`).

## Renaming an Element

1. Double-click the element's name in the [Layers Panel](layers-panel.md).
2. Type your new name.
3. Press **Enter** to confirm.

Your name is converted to a valid CSS class prefix. For example, "Hero Card" becomes `hero_card_a1b2` in the generated CSS. The short ID suffix is always appended to ensure uniqueness.

## Display

In the layers panel, names are shown in title case for readability (e.g. "Hero Card"), regardless of how they appear in the CSS output.

## Clearing a Name

Delete all text in the name field and press Enter. The element reverts to its default `rect_` or `text_` prefix.

## Round-Trip Behavior

Element names are stored in the generated files and survive round-trips. If you rename an element, save, and reopen the project, the name persists. External edits to the class name in the CSS file are also reflected back on the canvas.
