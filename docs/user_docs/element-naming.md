# Element naming

Every element in Scamp has a name that maps to its CSS class in the
generated code.

## Default names

- Rectangles are named `rect_` followed by a short ID, such as
  `rect_a1b2`.
- Text elements are named `text_` followed by a short ID, such as
  `text_c3d4`.

## Rename an element

1. In the [layers panel](layers-panel.md), double-click the element's
   name.
2. Type the new name.
3. Press **Enter**.

Scamp converts the name to a valid CSS class prefix. For example, "Hero
Card" becomes `hero_card_a1b2` in the generated CSS. Scamp always
appends the short ID, so every class is unique.

## How names appear

In the layers panel, names appear in title case for readability—for
example, "Hero Card"—regardless of how they appear in the CSS output.

## Clear a name

Delete all of the text in the name field and press **Enter**. The
element reverts to its default `rect_` or `text_` prefix.

## Duplicate a named element

Duplicating keeps the name and changes only the ID suffix, so
`menu_a1b2` duplicates to `menu_c3d4`. Both elements appear as "Menu" in
the layers panel, and each gets its own CSS class block with identical
styles. This applies to **Cmd+D**, paste, and the right-click
**Duplicate** command, and it works recursively: named children inside a
duplicated element keep their names too.

Elements without a name duplicate to the default `rect_` or `text_`
prefix.

## Round-trip behavior

Element names are stored in the generated files and survive round trips.
If you rename an element, save, and reopen the project, the name
persists. External edits to the class name in the CSS file also appear
on the canvas.
