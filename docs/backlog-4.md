# Scamp — Feature Backlog v4

User stories ordered easiest to hardest.

---

## 1. Box shadow DONE

**User story**

As a user designing a layout, I want to add box shadows to any element from
the WYSIWYG properties panel so I can create depth and elevation in my designs
without writing CSS manually.

**Behaviour**

- A "Shadow" section appears in the WYSIWYG panel for every selected element
- A "+ Add shadow" button appends a new shadow row — multiple shadows are
  supported per element
- Each shadow row has the following controls:

  | Control | Type | Default |
  |---|---|---|
  | X offset | Number input (px) | 0 |
  | Y offset | Number input (px) | 4px |
  | Blur | Number input (px) | 8px |
  | Spread | Number input (px) | 0 |
  | Color | Color picker + hex + opacity | rgba(0,0,0,0.15) |
  | Inset | Toggle | Off |

- Each row has a visibility toggle and a remove button
- Multiple shadows are output as a comma-separated `box-shadow` value:
  ```css
  box-shadow:
    0 4px 8px 0 rgba(0, 0, 0, 0.15),
    0 1px 2px 0 rgba(0, 0, 0, 0.08);
  ```
- Shadows round-trip through `parseCode` — both single and multiple shadow
  values parsed correctly back into individual rows
- Inset shadows are visually indicated in the panel with a subtle inset icon
  on the row

**Notes**

- `box-shadow` is one of the properties currently stored in `customProperties`
  and shown with a warning label. This feature promotes it to a first-class
  control and removes the warning
- The parser needs to handle the full `box-shadow` shorthand reliably
  including multiple values, rgba colors, and the optional `inset` keyword —
  test this thoroughly as it is one of the more complex CSS shorthands

---

## 2. CSS blend modes

**User story**

As a user designing a layout, I want to set the blend mode of any element
from the WYSIWYG properties panel so I can create layered visual effects
where elements blend into the elements behind them.

**Behaviour**

- A "Blend mode" dropdown appears in the appearance section of the WYSIWYG
  panel for every selected element
- Default is "Normal" — no blend mode property emitted to keep output clean
- Full list of supported values:

  | Group | Values |
  |---|---|
  | Normal | Normal |
  | Darken | Multiply, Darken, Color burn |
  | Lighten | Screen, Lighten, Color dodge |
  | Contrast | Overlay, Soft light, Hard light |
  | Inversion | Difference, Exclusion |
  | Component | Hue, Saturation, Color, Luminosity |

- Selecting any value other than Normal emits `mix-blend-mode` to the CSS:
  ```css
  mix-blend-mode: multiply;
  ```
- The canvas renders blend modes correctly since it is DOM-based and the
  browser handles `mix-blend-mode` natively
- Rounds-trips through `parseCode` — `mix-blend-mode` added to the property
  map

**Background blend mode**

- A separate "Background blend" dropdown appears in the background section
  when a background image is set on the element
- Maps to `background-blend-mode` — controls how the background image blends
  with the background color
- Same value list as mix-blend-mode above
- Only visible when both a background color and a background image are set

**Notes**

- Blend modes only have a visible effect when elements overlap — the canvas
  renders this correctly natively so no special handling needed
- `isolation: isolate` is a related CSS property worth noting in the raw CSS
  editor documentation — it controls the stacking context for blend modes.
  Out of scope for this story but agents may add it and it should round-trip
  through `customProperties` cleanly

---

## 3. Export pages and elements

**User story**

As a user who has finished designing a layout or a component, I want to
export a page or a selected element as a PNG, SVG, or PDF so I can share
it with stakeholders, use it in a presentation, or hand it off without
taking a manual screenshot.

**Behaviour — triggering an export**

- A "Export" option appears in two places:
  - In the toolbar: exports the entire canvas viewport
  - In the right-click context menu on a selected element: exports just
    that element and its children
- Both open the same Export panel — a small popover with format and
  settings options
- Keyboard shortcut: `Cmd+Shift+E` exports the current selection, or the
  full page if nothing is selected

**Export panel**

```
┌──────────────────────────────┐
│  Export                      │
│                              │
│  Format  [ PNG ] [ SVG ] [ PDF ] │
│                              │
│  Scale   [ 1x ] [ 2x ] [ 3x ]    │
│  (PNG only)                  │
│                              │
│  Size    1440 × 900px        │
│  (updates with scale)        │
│                              │
│  [ Export ]                  │
└──────────────────────────────┘
```

**PNG export**

- Default scale is 2x
- Scale options: 1x, 2x, 3x
- Size preview updates as scale changes:
  - 1x: canvas dimensions as designed
  - 2x: double the canvas dimensions
  - 3x: triple the canvas dimensions
- Uses `html-to-image` in the renderer to capture the selected element
  or the full canvas viewport
- Captures only design content — no canvas chrome, selection outlines,
  or resize handles
- Transparent backgrounds preserved — no background color set means
  transparent PNG output
- Opens a native OS save dialog defaulting to the project folder, file
  named `[page-name].png` or `[element-class].png`

**SVG export**

- Scale option hidden for SVG — resolution independent
- Uses `html-to-image` SVG output
- A subtle warning in the panel:
  "SVG export works best for simple layouts. Complex CSS effects may
  not be fully captured."
- Opens native OS save dialog, file named `[page-name].svg` or
  `[element-class].svg`

**PDF export**

- Scale option hidden — resolution handled by the print engine
- Uses Electron's `webContents.printToPDF()` via IPC channel `export:pdf`
- Page size options:

  | Option | Size |
  |---|---|
  | Canvas size (default) | Matches current canvas dimensions |
  | A4 | 210 × 297mm |
  | Letter | 216 × 279mm |
  | A3 | 297 × 420mm |

- Orientation toggle: Portrait / Landscape
- Opens native OS save dialog, file named `[page-name].pdf`

**Element vs page export**

- Page export captures the full canvas viewport at its current size
- Element export captures the selected element and all its children,
  cropped tightly to the element's bounding box with no surrounding
  whitespace

**IPC channels**

| Channel | Direction | Payload |
|---|---|---|
| `export:png` | renderer → main | `{ dataUrl, filename, path }` |
| `export:svg` | renderer → main | `{ svgString, filename, path }` |
| `export:pdf` | renderer → main | `{ filename, pageSize, landscape }` |

**Notes**

- Export is a read-only operation — it does not affect canvas state or
  project files
- The export panel remembers the last used format and scale settings
  per session
- Multi-element export is out of scope — one element or full page only
- Exporting captures the default state — animated or hover states are
  not captured
- Export reflects current canvas state, not the last saved file state

---

## 4. CSS filters

**User story**

As a user designing a layout, I want to apply CSS filter effects to any
element from the WYSIWYG properties panel so I can adjust blur, brightness,
contrast, saturation, and other visual properties without writing CSS
manually.

**Behaviour**

- A "Filters" section appears in the WYSIWYG panel for every selected
  element
- A "+ Add filter" button appends a new filter row — multiple filters
  are supported and applied in order
- Each filter row has a type dropdown and a value input:

  | Filter | Control | Range | CSS output |
  |---|---|---|---|
  | Blur | Number input (px) | 0–100 | `blur(8px)` |
  | Brightness | Slider + number (%) | 0–200 | `brightness(120%)` |
  | Contrast | Slider + number (%) | 0–200 | `contrast(80%)` |
  | Grayscale | Slider + number (%) | 0–100 | `grayscale(100%)` |
  | Hue rotate | Number input (deg) | 0–360 | `hue-rotate(90deg)` |
  | Invert | Slider + number (%) | 0–100 | `invert(100%)` |
  | Opacity | Slider + number (%) | 0–100 | `opacity(50%)` |
  | Saturate | Slider + number (%) | 0–200 | `saturate(150%)` |
  | Sepia | Slider + number (%) | 0–100 | `sepia(80%)` |

- Multiple filters combine into a single `filter` property:
  ```css
  filter: blur(4px) brightness(120%) grayscale(20%);
  ```
- Each row has a visibility toggle and a remove button
- The order of rows matches the order in the CSS output — filters are
  applied in sequence and order matters, so rows should be reorderable
  via drag and drop

**Backdrop filter**

- A separate "Backdrop filter" toggle in the Filters section enables
  `backdrop-filter` — applies filter effects to the content behind the
  element rather than the element itself
- Same filter type list as above
- Requires the element to have a partially transparent background to
  have a visible effect — a hint label explains this in the panel
- Output:
  ```css
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.1);
  ```
- The canvas renders `backdrop-filter` natively since it is DOM-based

**`parseCode` updates**

- `filter` and `backdrop-filter` added to the property map
- The `filter` value must be decomposed back into individual filter
  function rows — each function (`blur()`, `brightness()` etc.) parsed
  into its type and numeric value
- Unknown or unsupported filter functions preserved in `customProperties`
  verbatim

**Notes**

- Filter effects are visible in the canvas natively — no special rendering
  handling needed
- `filter: blur()` on a parent element affects all children — worth
  documenting in a tooltip since this surprises users who expect blur to
  apply only to backgrounds
- Backdrop filter has limited but good browser support — not a concern for
  the canvas since it uses Chromium, but worth noting in the export
  documentation for users who plan to ship the output
- The row reordering requirement makes this the most complex UI in this
  story — consider building filter rows without drag-to-reorder first and
  adding reordering in a follow-up

---

## 5. Visual history panel

**User story**

As a user designing a layout, I want to see a list of my recent changes
during the current session and click any entry to jump back or forward
to that point in my work, so I can navigate my history precisely without
having to hit Cmd+Z repeatedly and lose track of where I am.

**Behaviour**

**Opening the panel**

- The history panel is accessible from a "History" button in the toolbar
  or via `Cmd+Shift+H`
- It opens as a collapsible side panel or a floating panel alongside the
  existing properties panel — the user can pin it open or dismiss it
- The panel is per-page — switching pages shows the history for that page

**The history list**

- Shows up to 100 entries for the current session, most recent at the top
- Each entry shows:
  - A short description of what changed (see entry labels below)
  - The element name or class involved where relevant
  - A timestamp (relative: "just now", "2 min ago", or absolute time
    on hover)
- The current position in the history is highlighted — entries above it
  are in the past, entries below it have been undone and are greyed out
- Example list:

  ```
  ● Changed background — rect_a1b2        just now    ← current
    Changed gap — rect_a1b2              1 min ago
    Added element — rect_c3d4            1 min ago
    Changed width — rect_a1b2            3 min ago
    Changed display — rect_a1b2          3 min ago
    Drew rectangle                       5 min ago
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (undone)
    Changed border-radius — rect_a1b2    5 min ago
    Changed height — rect_a1b2           6 min ago
  ```

**Navigating history**

- Clicking any entry above the current position undoes to that point
- Clicking any entry below the current position (greyed out) redoes
  to that point
- The canvas and properties panel update immediately on click
- The file is written to disk after navigation the same way Cmd+Z does

**Branching behaviour**

- If the user is mid-history (some entries are undone) and makes a new
  change, the undone entries are discarded and the new change becomes
  the head — standard linear history model, no branching
- When undone entries are discarded the panel removes them from the
  list immediately

**History entry labels**

Each action type gets a short human-readable description:

| Action | Label |
|---|---|
| Drew a rectangle | "Drew rectangle" |
| Drew a text element | "Added text" |
| Deleted an element | "Deleted [name]" |
| Moved an element | "Moved [name]" |
| Resized an element | "Resized [name]" |
| Changed a CSS property via WYSIWYG | "Changed [property] — [name]" |
| Changed CSS via raw editor (commit) | "Edited styles — [name]" |
| Renamed an element | "Renamed [old] to [new]" |
| Added a page | "Added page [name]" |
| Deleted a page | "Deleted page [name]" |
| Pasted an element | "Pasted [name]" |
| Duplicated an element | "Duplicated [name]" |

Where [name] is the element's display name if it has one, or its class
prefix (`rect_a1b2`) if unnamed.

Consecutive changes to the same property on the same element within
500ms are collapsed into a single entry — dragging a slider to change
opacity from 100 to 47 should not create 53 history entries.

**Relationship to undo/redo**

- The history panel and Cmd+Z/Cmd+Shift+Z share the same underlying
  undo stack — they are two interfaces into the same system
- The stack limit matches the panel limit — 100 steps
- This supersedes the 50 step limit from the original undo/redo story
  in backlog v1

**Session scope**

- History is in-memory only — it does not persist between sessions
- Closing and reopening the app starts with a blank history
- Switching pages clears the panel display but each page maintains its
  own independent undo stack — navigating back to a page restores that
  page's history

**Notes**

- The consecutive-change collapse logic (500ms debounce) is important
  for usability — without it slider interactions and text edits generate
  noise that makes the history list unreadable
- Element names in history entries should update retroactively if an
  element is renamed — "rect_a1b2" should become "hero-card_a1b2" in
  all previous history entries for that element when it is renamed
- The panel is display-only during a canvas drag or resize operation —
  history entries are only written on mouseup, not during the drag
- External file edits (agent edits) appear in the history as a single
  entry: "External edit detected" with the timestamp. They clear the
  forward history the same as a manual change would

---

## Deferred follow-ups

### Box shadow row affordances (deferred from story #1)

The box-shadow story #1 shipped without two row affordances called for
in the spec. Both were deliberately deferred when story #1 landed
(2026-05-06):

- **Per-row visibility toggle.** The CSS file has no representation
  for a "disabled but remembered" shadow — toggling off would either
  drop the row from the file (lost on save/reload via bidirectional
  sync) or smuggle state into a CSS comment / private custom
  property. A clean implementation likely needs a separate
  session-only UI state mechanism that lives outside the elements
  model. Worth building once shared with story #4 (CSS filters)
  rather than bolting onto each section independently.
- **Drag-to-reorder rows.** First shadow renders on top, so order
  matters. Story #4 (CSS filters) explicitly calls for the same
  drag-to-reorder UX. Build the reorder pattern once for both
  sections in a single UX pass instead of shipping two slightly
  different versions.