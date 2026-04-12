# Scamp — Feature Backlog

User stories ordered easiest to hardest. Each item is scoped to a single shippable feature.

---

## 1. Remove layout section from text elements ✅

**User story**
As a user editing a text element, I don't want to see a layout/flex section in the properties panel because text elements can't have children and the controls don't apply, so the panel should only show relevant properties.

**Notes**

- The layout section (display, flex-direction, gap, align-items, justify-content) should be hidden when the selected element is of type `text`
- Padding may still be relevant for text elements and should stay

---

## 2. Shorthand values for box property inputs ✅

**User story**
As a user setting padding, margin, border, or border-radius in the WYSIWYG panel, I want to type shorthand values like `16`, `16 24`, or `8 16 8 16` the same way I would write CSS, so I don't have to fill in four separate fields when I want consistent or paired sides.

**Accepted formats**

- `x` — all sides equal
- `x x` — vertical | horizontal
- `x x x x` — top | right | bottom | left
- Values separated by spaces or commas (`16, 24` or `16 24` both work)

**Notes**

- Input should show a single text field, not four separate inputs
- On blur, parse the shorthand and display the resolved values as a preview (e.g. `top: 16 right: 24 bottom: 16 left: 24`)
- Invalid input should revert to the previous value without crashing

---

## 3. Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z) ✅

**User story**
As a user making changes on the canvas or in the properties panel, I want to undo my last action with Ctrl+Z (or Cmd+Z on Mac) and redo it with Ctrl+Shift+Z, so I can experiment freely without fear of losing my work.

**Notes**

- Undo/redo should cover: drawing elements, moving, resizing, property edits via WYSIWYG panel, and property edits via CSS editor
- File writes should be debounced around undo steps — undoing should update the file, not leave it out of sync
- A reasonable history limit is 50 steps
- External file edits (agent/chokidar) should clear the undo history for that page to avoid conflicts
- Consider Zustand middleware (`zustand/middleware` has a built-in `temporal` package via `zundo`) rather than rolling this from scratch

---

## 4. Project color swatches from document colors ✅

**User story**
As a user picking a color in the WYSIWYG panel, I want the color picker swatches to show colors already used in my project once I've added some, so I can stay consistent without having to remember or copy hex values manually.

**Behaviour**

- Before any colors are added: show a default set of neutral swatches (white, black, greys, a basic palette)
- Once the project has any color values in its CSS files: replace the default swatches entirely with colors extracted from the project
- Colors are extracted from the CSS modules at load time and whenever a file changes
- Duplicate colors are deduplicated; transparent and inherited values are excluded

**Notes**

- Color extraction can piggyback on the existing `parseCode` / chokidar pipeline — no new file watching needed
- Store extracted colors in a derived slice or selector, not as persisted state
- Order swatches by frequency of use (most used first)

---

## 5. Project themes and CSS variable tokens ✅

**User story**
As a user building a project, I want to define a set of named color (and later spacing/typography) tokens for my project that get saved as CSS variables, so I can use `--blue-500` instead of `#0000FF` across my designs and update them from one place.

**Theme file**
Each project gets a `theme.css` file in the project folder:

```css
:root {
  --blue-500: #0000ff;
  --grey-100: #f5f5f5;
  --text-primary: #111111;
  --spacing-md: 16px;
}
```

**Using tokens**

- In the WYSIWYG panel, color inputs should show a token picker alongside the color picker — selecting a token inserts `var(--blue-500)` as the value
- In the raw CSS editor, tokens are available as autocomplete suggestions
- Token values are reflected visually (the swatch shows the resolved color, not just the variable name)

**Managing tokens**

- A "Theme" panel or modal lets users add, rename, and delete tokens
- Changes to `theme.css` are watched by chokidar and hot-reloaded into the token picker
- Deleting a token that is in use should warn the user

**Notes**

- `theme.css` is a plain CSS file so it works outside Scamp too — if a user takes their project files elsewhere, the variables just work
- Token names should be validated (no spaces, must start with `--`)
- Spacing and typography tokens are out of scope for this story — color only for now

---

## 6. Element naming and layers panel ✅

**User story**
As a user building a layout with many elements, I want to give each element a human-readable name like "Sidebar" or "Hero Card" so the generated CSS class becomes `sidebar_a1b2` instead of `rect_a1b2`, and I can see all my elements in a named layers list in the left panel so I can select and navigate them without having to click directly on the canvas.

**Naming**

- Double-click an element's label in the layers panel to rename it
- Name is used as the CSS class prefix — replaces `rect` or `text` with the slugified name (e.g. "Hero Card" → `hero-card_a1b2`)
- Unnamed elements default to `rect_` or `text_` as they do today
- Names don't have to be unique — the ID suffix guarantees uniqueness

**Layers panel**

- Replaces or extends the current left sidebar below the pages list
- Shows the full element tree for the active page, indented to reflect nesting
- Clicking a layer selects that element on the canvas
- Selected element is highlighted in the layers list
- Layers can be reordered via drag and drop to change z-order among siblings

**Notes**

Renaming is a refactor operation, not a label change. The class name exists in two places — the `className` attribute in the `.tsx` file and the rule block selector in the `.module.css` file. Both must be updated atomically in a single write. If only one file is updated and the app crashes or the watcher fires in between, the files will be out of sync and the canvas will break.

The rename operation must follow this exact sequence:

1. User confirms the new name (hits Enter or blurs the input)
2. Compute the new class name: slugify the name + keep the existing ID suffix (e.g. `hero-card_a1b2`)
3. Read both the current `.tsx` and `.module.css` into memory
4. In the TSX: find `className={styles.rect_a1b2}` and replace with `className={styles.hero-card_a1b2}`
5. In the CSS: find the `.rect_a1b2 { ... }` rule block and replace the selector with `.hero-card_a1b2` — leave the declarations untouched
6. Write both files to disk in a single IPC call (`file:write`) — never write one without the other
7. Zustand state is updated after both files are confirmed written — never before
8. chokidar will fire for both files; the app should recognise this as a rename-triggered reload and not treat it as an external edit

This should go through a dedicated IPC channel `element:rename` rather than the generic `file:patch` channel so the main process can handle the two-file atomic write explicitly and the intent is clear in the codebase.

A failed rename (e.g. disk write error) must leave both files unchanged — do not write one and bail. If the write fails, surface an error and keep the old name in state.

---

## 7. Copy and paste elements

**User story**
As a user building a layout, I want to copy a selected element with Cmd+C and paste it with Cmd+V so I get a duplicate with a new ID, saving me from having to redraw and restyle repeated elements from scratch.

**Behaviour**

- Cmd+C copies the selected element and all its children into an internal clipboard (not the system clipboard)
- Cmd+V pastes it as a sibling of the currently selected element, or onto the page root if nothing is selected
- The pasted element gets a new ID (and therefore a new class name) — it is never just a reference to the original
- Pasted element is immediately selected
- Cmd+D as a shortcut for copy+paste in one step (duplicate in place) is a nice-to-have

**Notes**

- Deep copy — all child elements are duplicated recursively with new IDs
- CSS for the new class is written to the module file on paste, copied from the source class

---

## 8. Images

**User stories**

As a user designing a layout, I want to drag an image file from my computer onto
the canvas or click an image button in the toolbar so I can place a image as an
`<img>` element directly in my design.

As a user designing a layout, I want to select a rectangle and set an image as
its CSS background from the properties panel so I can use images as fills with
full control over how they scale and repeat.

---

**Behaviour — img element (toolbar / drag to canvas)**

- Click the image button in the toolbar (keyboard: `I`) then click anywhere on
  the canvas or inside a rectangle to place an `<img>` element
- Alternatively, drag an image file from the OS directly onto the canvas or into
  a rectangle to place it as an `<img>` element at that position
- Supported formats: PNG, JPG, WebP, SVG, GIF
- The image file is copied into an `assets/` folder inside the project directory
- The generated TSX uses a relative import:

```tsx
<img
  data-scamp-id="e5f6"
  className={styles.img_e5f6}
  src="../assets/image.png"
  alt=""
/>
```

- Default size is the image's natural dimensions, editable via the properties
  panel like any other element (fixed or stretch width/height)
- The element appears in the layers panel as `img_[id]`

---

**Behaviour — background image (properties panel)**

- When a rectangle is selected, the background section of the WYSIWYG properties
  panel shows a "Set background image" button
- Clicking it opens a native OS file picker — supported formats: PNG, JPG,
  WebP, SVG
- The image file is copied into the project's `assets/` folder
- The CSS is updated with a relative path:

```css
background-image: url("../assets/image.png");
background-size: cover;
background-position: center;
background-repeat: no-repeat;
```

- Once a background image is set, the background section of the properties panel
  expands to show dedicated background controls:

  | Control             | Type                                                | Default   |
  | ------------------- | --------------------------------------------------- | --------- |
  | Background size     | Segmented: Cover / Contain / Auto / Custom          | Cover     |
  | Background position | 9-point grid picker + x/y inputs                    | Center    |
  | Background repeat   | Segmented: No repeat / Repeat / Repeat X / Repeat Y | No repeat |

- These controls write directly to the CSS file and round-trip through the parser
  the same as any other property
- A "Remove background image" button clears the `background-image` property and
  hides the background controls, reverting the section to the standard background
  color control
- Dropping a new image onto a rectangle that already has a background image
  replaces it

---

**Shared notes**

- All image files are copied into `assets/` — the original file is never moved
  or deleted
- Removing an image element or clearing a background image does not delete the
  file from `assets/` — the user manages that manually
- The `assets/` folder is documented in `agent.md` so agents know it exists and
  can reference images using the same relative path convention
- Both image types are visible as real rendered images in the canvas viewport

---

## 9. Add new page and duplicate page

**User story — add new page**
As a user with a project open, I want to create a new blank page by clicking an "+ Add Page" button in the pages sidebar, give it a name, and have the app create the corresponding `.tsx` and `.module.css` files in my project folder so I can start designing a new screen immediately.

**User story — duplicate page**
As a user iterating on a layout, I want to right-click an existing page in the sidebar and choose "Duplicate" so I get an exact copy of that page's files under a new name, letting me explore variations without starting from scratch or losing my original.

**Add new page flow**

- Click "+ Add Page" at the bottom of the pages sidebar
- An inline text input appears in the sidebar for the page name
- Name is validated: lowercase, alphanumeric and hyphens only, no spaces, must be unique within the project (e.g. `checkout-flow`)
- On confirm: creates `[name].tsx` and `[name].module.css` with the standard empty page template, switches to the new page
- On Escape: cancels without creating anything

**Duplicate page flow**

- Right-click any page in the sidebar → "Duplicate"
- New page name defaults to `[original-name]-copy`, immediately editable inline
- Copies both `.tsx` and `.module.css` content verbatim, then rewrites the component function name to match the new page name
- All element IDs and class names are kept identical — they are unique within a file, not across the project, so no conflicts arise
- Switches to the duplicated page on confirm

**Notes**

- Both flows reuse the same inline naming input component
- The pages sidebar should show a loading/creating state briefly while files are being written to disk

---

## 10. Nudge with arrow keys

**User story**

As a user positioning elements on the canvas, I want to nudge a selected element
one pixel at a time using the arrow keys on my keyboard, and ten pixels at a time
when holding Shift, so I can make precise adjustments without reaching for the
mouse.

As a user editing values in the WYSIWYG properties panel, I want to increment or
decrement any number field by 1 using the up and down arrow keys, and by 10 when
holding Shift, so I can adjust values quickly without retyping them.

---

**Behaviour — canvas nudge**

- When an element is selected and the canvas has focus, pressing any arrow key
  moves the element by 1px in that direction
- Holding Shift while pressing an arrow key moves the element by 10px
- Nudge updates the element's `x` and `y` position in Zustand state and
  triggers the normal debounced file write — the CSS file updates exactly as if
  the user had dragged the element
- Nudge only applies to elements with absolute positioning — if a future layout
  mode removes absolute positioning this behaviour should be revisited
- If no element is selected, arrow keys do nothing on the canvas
- Arrow key events on the canvas must not fire when focus is inside the
  properties panel, the CSS editor, the code panel, or the terminal — standard
  browser focus rules handle this provided the canvas element manages focus
  correctly with `tabIndex`

---

**Behaviour — number field nudge (WYSIWYG panel)**

- Any number input in the WYSIWYG panel responds to up and down arrow keys when
  that input has focus
- Up arrow increases the value by 1; down arrow decreases by 1
- Shift + up arrow increases by 10; Shift + down arrow decreases by 10
- The value updates immediately on each keydown — the user should see the canvas
  respond in real time as they hold the key
- The field commits and triggers a file write on `blur` or `Enter`, the same as
  a manual edit — not on every individual keydown, to avoid flooding the file
  system with writes while the key is held
- Values should not go below zero for properties where a negative value is not
  meaningful (width, height, border-radius, border-width, font-size) — clamp at
  0 for those fields
- Properties where negative values are valid (x, y position, margin) should have
  no lower bound

---

**Notes**

- The 1px / 10px increment convention matches Figma and most other design tools
  so it will feel immediately familiar to users coming from those tools
