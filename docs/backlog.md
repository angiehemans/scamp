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

## 6. Element naming and layers panel

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

## 8. Image fill

**User story**
As a user designing a layout, I want to set an image as the background of a rectangle by dragging an image file from my computer onto it, so I can place photos, illustrations, and assets directly in my design without leaving the app.

**Behaviour**

- Drag an image file from the OS onto any rectangle to set it as `background-image`
- Supported formats: PNG, JPG, WebP, SVG
- The image file is copied into an `assets/` folder inside the project directory
- The generated CSS references the image with a relative path: `background-image: url('../assets/image.png')`
- Default background-size is `cover` and background-position is `center` — both editable via the CSS panel
- Dropping a new image onto a rectangle that already has one replaces it

**Notes**

- The `assets/` folder should be documented in `agent.md` so agents know it exists and can reference images too
- Image fill is visible in the canvas viewport as a real rendered background
- Removing an image fill (setting background-image back to none) does not delete the file from `assets/` — the user manages that manually

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
