# Scamp — Feature Backlog v10

User stories ordered easiest to hardest.

---

## 1. Collapse elements in the tree

**User story**

As a user working with a deeply nested layout, I want to collapse an
element in the layers tree to hide its children so I can reduce clutter
and focus on the part of the tree I am working with.

**Behaviour**

- Every element in the layers tree that has children shows a small
  disclosure triangle to the left of its name
- Clicking the triangle collapses the element, hiding all of its
  descendants in the tree
- Clicking again expands it, showing the children
- The triangle points down when expanded, right when collapsed
- Collapsing an element in the tree does not affect the canvas — it is
  purely a tree display convenience
- Collapse state is remembered per element for the session — collapsing
  an element and clicking away keeps it collapsed until the user expands
  it again
- Collapse state does not persist between sessions and is not written to
  any file — it is UI state only

**Interaction details**

- `Cmd+click` (or `Alt+click`) the triangle collapses or expands the
  element and all of its descendants at once (collapse all / expand all
  from that node)
- When an element is selected on the canvas, the tree auto-expands any
  collapsed ancestors so the selected element is always visible in the
  tree
- A collapsed element with a selected descendant shows a subtle
  indicator (a dot or highlight) signalling that something inside it is
  selected even though the children are hidden

**Notes**

- This is purely a tree UI feature — no impact on the canvas, the file
  output, or the parse pipeline
- Collapse state lives in the tree component's local state or a UI slice
  of Zustand, never in the element model

---

## 2. Duplicate preserves element names

**User story**

As a user who has renamed elements in my layout, I want duplicated
elements (via copy, paste, or Cmd+D) to keep the same display name so
my named elements stay consistent, while still getting a unique ID in
the code so nothing collides.

**Context**

Scamp elements use a `[name]_[4-char-id]` class naming convention. A
renamed div becomes `menu_a1b2`. When that element is duplicated the
duplicate must keep the `menu` name prefix but get a new unique ID
suffix so the two do not collide.

**Behaviour**

- Duplicating an element (Cmd+D, copy/paste, or right-click Duplicate)
  produces a copy with:
  - The same display name in the layers tree ("Menu")
  - The same name prefix in the class (`menu`)
  - A new unique 4-character ID suffix (`menu_c3d4` instead of
    `menu_a1b2`)
- The duplicate appears in the tree with the same name as the original
- If multiple duplicates are made, each gets its own unique ID —
  `menu_c3d4`, `menu_e5f6`, etc. — but they all share the "Menu"
  display name
- This applies recursively — if a duplicated element has named
  children, each child keeps its name and gets a new unique ID

**Generated code example**

Original:
```tsx
<nav data-scamp-id="a1b2" className={styles.menu_a1b2}>
```

After Cmd+D:
```tsx
<nav data-scamp-id="a1b2" className={styles.menu_a1b2}>
<nav data-scamp-id="c3d4" className={styles.menu_c3d4}>
```

Both are named "Menu" in the tree, both share the `.menu` naming
convention, but the IDs and full class names are unique.

**CSS handling**

The duplicated element gets its own CSS class block with the new ID.
The styles are copied verbatim from the original:

```css
.menu_a1b2 { display: flex; gap: 16px; }
.menu_c3d4 { display: flex; gap: 16px; }
```

**Notes**

- The name-preservation logic lives in the duplicate/paste operation —
  when generating the new element, keep the name prefix and only
  regenerate the ID suffix
- Duplicate naming should be consistent across all three duplication
  paths: Cmd+D, copy/paste, and right-click Duplicate
- This depends on the element naming feature being complete — named
  elements must exist before this behaviour matters

---

## 3. Copy, cut, and paste elements

**User story**

As a user building layouts, I want to copy or cut elements and their
content and paste them on the same page or a different page so I can
reuse structures without rebuilding them from scratch.

**Behaviour — copy and cut**

- `Cmd+C` copies the selected element (and all its children and styles)
  to an internal clipboard
- `Cmd+X` cuts the selected element — copies it to the clipboard and
  removes it from the canvas
- Right-click context menu also offers Copy and Cut
- Multiple elements can be selected and copied/cut at once
- The clipboard holds the full element subtree: structure, styles,
  text content, and any nested elements

**Behaviour — paste**

- `Cmd+V` pastes the clipboard contents
- Paste target logic:
  - If an element is selected, paste as a child of that element (or as
    a sibling if the selected element is not a container — configurable)
  - If nothing is selected, paste into the root of the current page
  - If pasting onto the canvas at a specific point (right-click paste),
    paste at that position
- Pasted elements get new unique IDs but keep their names (see story 2)
- `Cmd+Shift+V` pastes in place at the exact position copied from
  (useful for moving an element to the same spot on another page)

**Cross-page paste**

- The clipboard persists across page switches — copy an element on one
  page, switch to another page, and paste it there
- Cross-page paste is a key use case — building a nav on one page and
  reusing it on others

**Cross-project paste**

- The clipboard persists across projects within the same Scamp session
- Copy an element in one project, open another project, paste it in —
  the element structure and styles come with it
- Referenced theme tokens that do not exist in the target project fall
  back to their resolved values (e.g. `var(--color-brand)` becomes the
  hex value if the target project has no `--color-brand` token) with a
  subtle warning

**Clipboard format**

The internal clipboard stores a serialized element subtree:

```ts
interface ClipboardPayload {
  elements: ElementNode[];   // the subtree
  styles: Record<string, CSSProperties>;  // styles by element ID
  sourceProjectId: string;
  copiedAt: number;
}
```

**System clipboard integration**

- When an element is copied, a text representation (the TSX + CSS) is
  also placed on the system clipboard
- This means a user can paste the actual code into a text editor or
  share it — useful for the agent workflow and for debugging
- Pasting from the system clipboard: if the clipboard contains valid
  Scamp-generated TSX, Scamp parses it and pastes it as elements. If
  not, it is ignored for canvas paste

**Notes**

- The internal clipboard (structured element data) is the primary
  mechanism. The system clipboard (text TSX/CSS) is a secondary
  convenience
- Paste must generate new unique IDs for every pasted element to avoid
  collisions with existing elements on the target page
- Named elements keep their names on paste (story 2 behaviour)
- Cut followed by paste is effectively a move — but implemented as
  copy-to-clipboard, remove, then paste on the next Cmd+V

---

## 4. Drag and drop placement helpers

**User story**

As a user reordering elements on the canvas or in the layers tree, I
want clear visual feedback showing exactly where my dragged element
will land so I do not accidentally drop it inside the wrong container
when I meant to place it between two elements.

**The problem**

When dragging an element near a container, it is ambiguous whether the
element will drop inside that container or between it and its neighbor.
Users frequently drop into a container they did not intend to. This
feature removes that ambiguity with clear drop-target visualization.

**Behaviour — dropping into a container**

When the dragged element will drop inside a container (becoming its
child):

- The target container is highlighted with a colored outline (border
  or background tint) signalling "this will become a child of this
  container"
- The highlight covers the whole container so the user clearly sees
  the boundary of what they are dropping into

**Behaviour — dropping between two elements**

When the dragged element will drop between two siblings (as a sibling,
not a child):

- A gap opens up between the two elements at the drop position — the
  elements visually shift apart to make room
- A colored insertion line (or highlighted gap) appears in that space
  signalling "this will drop here, between these two elements"
- This makes the sibling-vs-child distinction unambiguous — a gap with
  a line means between, a highlighted container means inside

**Visual states summary**

```
Dropping INSIDE a container:
┌─────────────────────────────┐
│ ▓▓▓▓▓ container highlighted ▓│  ← whole container outlined/tinted
│                             │
│   [existing child]          │
│                             │
└─────────────────────────────┘

Dropping BETWEEN two elements:
   [element A]
  ═══════════════  ← insertion line in an opened gap
   [element B]
```

**Behaviour in the layers tree**

The same logic applies to the layers tree:

- Dragging over an element's row highlights that row if the drop will
  make the dragged element a child of it
- Dragging between two rows opens a gap and shows an insertion line at
  that position if the drop will make it a sibling
- The indentation of the insertion line reflects the nesting level it
  will drop into — a line indented under a container means it drops
  inside, a line at the parent's level means it drops as a sibling

**Drop zone detection**

The distinction between inside and between is determined by cursor
position relative to the target element:

- Cursor in the top 25% of an element's height → drop before (sibling,
  above)
- Cursor in the bottom 25% → drop after (sibling, below)
- Cursor in the middle 50% → drop inside (child), only if the element
  is a container
- For non-container elements (text, images) the middle zone also
  becomes before/after since they cannot have children

**Behaviour details**

- The highlight and insertion line update in real time as the cursor
  moves during the drag
- A container that cannot accept children (a text element, an image)
  never shows the "drop inside" highlight — only before/after insertion
  lines
- Dropping is confirmed on mouse release at the currently indicated
  position
- Pressing Escape during a drag cancels the operation with no change

**Notes**

- This is one of the highest-value UX improvements in the backlog —
  element reordering is a constant operation and the current ambiguity
  is a frequent source of frustration
- The 25/50/25 zone split is a starting point — it may need tuning
  based on testing. Smaller elements may need a different ratio since
  the middle zone gets very small
- The gap-opening animation should be quick (100-150ms) so it feels
  responsive, not sluggish
- Both the canvas and the tree should use the exact same drop-target
  logic so the behaviour is consistent between them
- This is the most complex story in this backlog because it touches
  drag state management, hit-testing against the element tree, and
  real-time visual feedback on both the canvas and the tree

  ## 5. Images already in project folder are duplicating.

 -when a user chooses an image that is already in their project image folder scamp re-imports that image as if the user is pulling it in from another folder, hence duplicating the image.
 - Scamp needs to be aware when a user chooses an image that is already in its projects image folder and simply place it on the canvas without duplicating it.
 - Scamp also needs to compress images to be web ready, so we can serve images faster and more efficiently, maybe convert to webp?