# PRD: Scamp — Local Design Tool (Proof of Concept)

## Overview

Scamp is a local-first design tool that lets users visually compose layouts using nested rectangles and flex controls. Unlike traditional design tools, the output is real code — each page saves as a `.tsx` file and a `.module.css` file that update in real time as the user designs. A built-in terminal lets users run a coding agent or git commands against their project folder.

This document covers the proof-of-concept scope only. The goal is a working, end-to-end vertical slice: open a project, design a layout, see real code, edit it with an agent, and have the canvas stay in sync in both directions.

---

## Goals

- Validate the full bidirectional sync loop: design visually ↔ auto-save to real TSX/CSS ↔ external edits reload the canvas
- Prove the DOM-based canvas approach is fast and predictable enough for the use case
- Use a raw CSS text editor as the properties panel to test parsing and round-tripping without building UI controls yet
- Keep scope ruthlessly small — no polish, no edge cases, just the happy path working end to end

## Non-Goals (POC)

- WYSIWYG property controls (color pickers, sliders, dropdowns) — deferred to post-POC
- Multiple users / collaboration
- Undo/redo history
- Exporting or previewing the project outside the app
- Complex typography controls
- Responsive breakpoints
- Component/symbol libraries
- Any form of cloud sync

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| App shell | Electron + electron-vite | File system + terminal access; fast HMR dev experience |
| UI framework | React + TypeScript | Familiar, strong ecosystem, ideal for DOM canvas |
| State management | Zustand | Low boilerplate, slice-friendly for nested canvas state |
| Styling | CSS Modules | Matches the output format; keeps app styles separate from generated styles |
| Properties panel editor | CodeMirror | Lightweight, embeds cleanly in React, has CSS language mode |
| CSS parsing | postcss | Robust AST-based CSS parsing for bidirectional sync and targeted class replacement |
| TSX parsing | htmlparser2 | Lightweight; sufficient since we only parse our own known output format |
| Terminal | node-pty + xterm.js | Same approach as VS Code; real shell, not a fake one |
| File watching | chokidar | Reliable cross-platform file watcher for auto-reload |
| Packaging | electron-builder | Standard for distributing Electron apps |

---

## Core Concepts

### Project
A named folder on the user's local file system. Contains one `agent.md` file and one `.tsx` + `.module.css` pair per page.

```
my-project/
├── agent.md
├── home.tsx
├── home.module.css
├── dashboard.tsx
└── dashboard.module.css
```

### Page
A full-screen design surface. Renders as a single React component. Has its own flex settings (direction, gap, align, justify) that apply to its direct children.

### Rectangle
The only design primitive in the POC. A `div` with configurable visual and layout properties. Rectangles can be nested arbitrarily deep. Each rectangle maps directly to a `div` in the output TSX and a class in the output CSS module.

### Agent Instructions (`agent.md`)
A markdown file auto-generated when a project is created. Documents the code conventions the app uses so a coding agent can make edits without breaking the app's expectations. The user can edit this file freely.

---

## Bidirectional Sync Architecture

This is the most important system in the app. Scamp changes write to files; external file changes (agent edits, manual edits) reload the canvas. Both directions must work reliably.

### Stable Element Identity

Every element has a `data-scamp-id` attribute in the TSX output. This is the anchor for the entire sync system. As long as this attribute is present, the app can always map DOM node → element ID → CSS class → canvas state.

```tsx
<div data-scamp-id="a1b2" className={styles.rect_a1b2}>
  <div data-scamp-id="c3d4" className={styles.rect_c3d4} />
</div>
```

`agent.md` explicitly instructs agents never to remove `data-scamp-id` attributes and never to rename generated CSS classes.

### Two Pure Functions

The sync system is built on two pure, well-tested functions that are the most critical code in the app:

**`generateCode(elements, rootId, pageName) → { tsx: string, css: string }`**

Takes Zustand element state and produces file content. Called on every canvas state change; result is debounced 200ms before writing to disk. Written atomically (write to `.tmp`, rename) to avoid partial reads.

**`parseCode(tsx: string, css: string) → ElementTree`**

Takes file content and produces element state. Called whenever chokidar detects a file change. Diffs against current Zustand state and only triggers a re-render if something actually changed (prevents canvas flicker during live agent edits).

Both functions are developed and unit tested in isolation before being wired to the canvas.

### Parse Strategy

**TSX parse — structure (via htmlparser2)**

Extracts the component tree: element IDs, class names, parent/child relationships. Only needs to handle the fixed output format the app generates, so a full TSX parser is not required. Looks for `data-scamp-id` and `className={styles.[type]_XXXX}` patterns; nesting gives parent/child.

**CSS parse — properties (via postcss)**

For each class in the CSS module, extract properties and map to canvas state via a known property map:

```ts
const cssToScampProperty = {
  'background':        (v) => ({ backgroundColor: v }),
  'background-color':  (v) => ({ backgroundColor: v }),
  'border-radius':     (v) => ({ borderRadius: parsePx(v) }),
  'display':           (v) => ({ display: v }),
  'flex-direction':    (v) => ({ flexDirection: v }),
  'gap':               (v) => ({ gap: parsePx(v) }),
  'align-items':       (v) => ({ alignItems: v }),
  'justify-content':   (v) => ({ justifyContent: v }),
  'width':             (v) => v === '100%'
                               ? { widthMode: 'stretch' }
                               : { widthMode: 'fixed', widthValue: parsePx(v) },
  'height':            (v) => v === '100%'
                               ? { heightMode: 'stretch' }
                               : { heightMode: 'fixed', heightValue: parsePx(v) },
  'border':            (v) => parseBorderShorthand(v),
  'border-width':      (v) => ({ borderWidth: parsePx(v) }),
  'border-style':      (v) => ({ borderStyle: v }),
  'border-color':      (v) => ({ borderColor: v }),
  'padding':           (v) => ({ padding: parsePaddingShorthand(v) }),
  'font-size':         (v) => ({ fontSize: parsePx(v) }),
  'font-weight':       (v) => ({ fontWeight: parseInt(v) }),
  'color':             (v) => ({ color: v }),
  'text-align':        (v) => ({ textAlign: v }),
};
```

Any property **not in this map** is stored in a `customProperties: Record<string, string>` bag on the element. It round-trips through the file untouched and is visible in the panel editor — it just doesn't map to a canvas state field. When WYSIWYG controls are built later, this bag shrinks as more properties get mapped.

### Defaults

A `DEFAULT_ELEMENT_STYLES` object defines the CSS applied to every new element. The code generator only emits properties that differ from defaults, keeping output clean. The parser applies defaults first, then overlays what it finds in the CSS file.

```ts
const DEFAULT_RECT_STYLES = {
  display: 'none',
  flexDirection: 'row',
  gap: 0,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: [0, 0, 0, 0],
  widthMode: 'fixed',
  widthValue: 100,
  heightMode: 'fixed',
  heightValue: 100,
  backgroundColor: 'transparent',
  borderRadius: 0,
  borderWidth: 0,
  borderStyle: 'none',
  borderColor: '#000000',
};
```

### Full Sync Loop

```
Scamp state change
  → generateCode() → debounce 200ms → write .tsx + .module.css

File change detected (chokidar)
  → Read .tsx + .module.css
  → parseCode() → ElementTree
  → Diff against current Zustand state
  → If changed: update state → canvas re-renders → panel reloads
```

---

## Features

### 1. Project Management

**Where projects are stored**

Projects live wherever the user chooses on their own file system — there is no app-managed storage location. This is intentional. Users will want their projects inside their existing folder structure (`~/dev/`, `~/projects/`, a client work folder, an existing git repo) so they can use the terminal, run agents, and open the folder in other editors without any friction. The app never moves, copies, or manages project files beyond what the user explicitly creates.

The only thing stored in `app.getPath('userData')` is the recent projects list — a small JSON file of project names and paths. That is app metadata, not user content.

**Create project**
- User clicks "New Project" and gets a native OS "Choose Folder" dialog
- They pick an existing empty folder or create a new one in the dialog
- App writes `agent.md` and creates a default first page (`home.tsx` + `home.module.css`) into that folder
- Project is added to the recent projects list

**Open project**
- User clicks "Open Project" and gets a native OS "Choose Folder" dialog, or clicks a recent project
- App reads the folder, discovers `.tsx` files by name, and loads the project
- If a folder is opened that has no `.tsx` files, show an empty project with a prompt to create the first page

**Recent projects**

The start screen shows the last 5 opened projects. Stored in `app.getPath('userData')` as a JSON file:

```json
{
  "recentProjects": [
    { "name": "my-portfolio", "path": "/Users/jane/dev/my-portfolio", "lastOpened": "2026-04-07T10:00:00Z" },
    { "name": "client-dashboard", "path": "/Users/jane/work/client-dashboard", "lastOpened": "2026-04-01T09:00:00Z" }
  ]
}
```

If a recent project's path no longer exists on disk (moved or deleted), show it greyed out with a "Folder not found" label — do not crash or silently drop it. The user can remove it from the list manually.

---

### 2. Page Management

**Create page**
- User clicks "+ Page" in the left sidebar
- Prompted to name the page (alphanumeric + hyphens, e.g. `checkout-flow`)
- App creates `[name].tsx` and `[name].module.css` in the project folder

**Switch pages**
- Clicking a page name in the sidebar loads that page's canvas
- Active page is highlighted

**Delete page**
- Right-click a page → Delete
- Removes both files from disk

---

### 3. The Scamp

The canvas is a DOM-based design surface. Rectangles are real `div`s rendered inside a scaled viewport. There is no WebGL or Canvas API involved.

**Viewport**
- Renders inside a white frame with a fixed aspect ratio (default: 1440×900)
- Scales to fit the available panel space
- Light checkerboard background outside the frame

**Selecting elements**
- Click a rectangle to select it; its CSS properties load into the panel editor
- Click the canvas background to deselect
- Selected element shows a blue 1px outline (UI feedback only, not part of the design)

**Drawing a rectangle**
- User selects the Rectangle tool (keyboard: `R`)
- Click-drag on the canvas or inside an existing rectangle to draw
- Minimum size: 20×20px
- On release, rectangle is created with default styles and immediately selected
- Panel editor populates with the new element's (empty) class body

**Moving a rectangle**
- Click-drag on a selected rectangle (when not in draw mode) to reposition
- Position stored as pixel values using `position: absolute` inside the parent for POC

**Resizing a rectangle**
- 8 resize handles appear on the selected element (corners + edge midpoints)
- Drag to resize

---

### 4. Properties Panel — Raw CSS Editor

The properties panel is a **CodeMirror editor** showing the raw CSS property declarations for the selected element's class. There are no dropdowns, color pickers, or sliders in the POC. The user edits CSS directly.

**Load behavior**
- When an element is selected, the editor loads that element's class body from parsed state
- Only the declarations are shown — no selector, no braces:

```css
display: flex;
flex-direction: row;
gap: 16px;
background: #f0f0f0;
border-radius: 8px;
width: 400px;
height: 300px;
```

**Edit behavior**
- User can type any valid CSS — any property, any format, any shorthand
- On commit (blur or `Cmd+S`):
  1. Find the element's class block in the CSS module via postcss
  2. Replace just that block's declarations with the new text
  3. Write the file
  4. chokidar fires → `parseCode()` → state update → canvas re-renders → panel reloads
  5. Panel reloading from parsed state confirms the round-trip worked

**Unknown properties**
- Properties not in the known map are preserved in `customProperties` and shown in the editor
- They appear in the output CSS untouched
- A subtle label at the bottom of the panel lists any properties the canvas can't visually represent, e.g. `⚠ box-shadow, transform — displayed in file, not reflected on canvas`

**No element selected**
- Panel shows a placeholder: `← Select an element to edit its styles`

This design means the panel doubles as the primary testing surface for the parse/sync loop. Every edit is a round-trip test. The raw CSS editor is also likely worth keeping permanently as a "CSS" tab alongside future WYSIWYG controls — power users will want it.

---

### 5. Text Elements

Basic text support for the POC.

**Add text**
- User selects the Text tool (keyboard: `T`)
- Click on the canvas or inside a rectangle to place a text element
- A `<p>` tag is created inside a wrapping `div`, immediately enters edit mode (contentEditable)
- Press Escape or click away to commit

**Text styling**
- Handled entirely through the CSS editor panel — no separate text controls in the POC
- Font size, weight, color, text-align are all just CSS properties in the class
- Text content is edited directly on the canvas (double-click to re-enter edit mode)

Text elements participate in flex layout the same as rectangles.

---

### 6. Code Output

#### TSX output format

```tsx
import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="a1b2" className={styles.rect_a1b2}>
        <div data-scamp-id="c3d4" className={styles.rect_c3d4} />
      </div>
    </div>
  );
}
```

#### CSS Modules output format

Only non-default properties are emitted. Output is clean and readable.

```css
.root {
  width: 1440px;
  height: 900px;
  position: relative;
}

.rect_a1b2 {
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: center;
  padding: 24px;
  width: 400px;
  height: 300px;
  background: #f0f0f0;
  border-radius: 8px;
  border: 1px solid #cccccc;
}

.rect_c3d4 {
  width: 100px;
  height: 100px;
  background: #3b82f6;
}
```

#### Code panel (bottom, toggleable)
- Split view: TSX on the left, CSS on the right
- Read-only display (editing via panel editor, agent, or external editor)
- Syntax highlighted
- Updates live as the user designs or as files change externally

---

### 7. Built-in Terminal

A full terminal panel at the bottom of the app (toggled with `` Ctrl+` ``).

**Behavior**
- Opens a real shell via `node-pty`, rendered with `xterm.js`
- Working directory set to the open project folder automatically
- Supports up to 3 tabs in the POC
- Persists across page switches; killed when app closes

**Agent use case**
- User runs their preferred coding agent CLI in the terminal
- Agent reads `agent.md` for conventions, edits `.tsx` and `.module.css` files
- chokidar detects changes, `parseCode()` runs, canvas and panel reload automatically
- No special integration needed — the file-watch loop handles everything

---

### 8. `agent.md` — Auto-generated Instructions

Created automatically when a project is created. Editable by the user.

```markdown
# Scamp Project — Agent Instructions

## Critical rules
- Never remove `data-scamp-id` attributes from any element
- Never rename CSS classes that follow the `[type]_XXXX` pattern
- Never combine multiple selectors into one rule block
- Never add media queries to generated class blocks
- One class = one rule block, always

## Project structure
Each page is two files: `[page-name].tsx` and `[page-name].module.css`.
Do not rename, move, or split these files.

## Component conventions
- Each page exports a single default React component
- The root element uses `styles.root` and `data-scamp-id="root"`
- Child element class names follow the pattern `[type]_[4-char-id]` where type is `rect` or `text` (e.g. `rect_a1b2`, `text_c3d4`)
- Do not add inline styles — all styles live in the CSS module

## CSS conventions
- All sizing in px unless the element stretches (stretch = `width: 100%`)
- Flex layout is used for all container elements
- One property per line
- Shorthand is fine (e.g. `border: 1px solid #ccc`, `padding: 16px 24px`)

## What NOT to change
- Do not alter the import line at the top of the TSX file
- Do not rename the default export function
- Do not add new files unless the user asks for a new page
```

---

## App Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Select] [Rectangle] [Text]        [Project name] │
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │                   │
│  Pages   │        Scamp                │  CSS Editor       │
│  sidebar │        (viewport)            │  (CodeMirror)     │
│          │                              │                   │
│          │                              │  display: flex;   │
│  + Page  │                              │  gap: 16px;       │
│          │                              │  width: 400px;    │
│          │                              │                   │
│          │                              │  ⚠ box-shadow     │
├──────────┴──────────────────────────────┴───────────────────┤
│  [Code ▾]  [Terminal ▾]                                     │
│  ┌ home.tsx ────────────┐  ┌ home.module.css ─────────────┐ │
│  │ (read-only, syntax   │  │ (read-only, syntax           │ │
│  │  highlighted)        │  │  highlighted)                │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## IPC Architecture (Electron)

The renderer process communicates with the main process via typed IPC channels. No direct `fs` access from the renderer.

| Channel | Direction | Payload |
|---|---|---|
| `project:open` | renderer → main | folder path |
| `project:read` | main → renderer | `{ pages: PageFile[] }` |
| `file:write` | renderer → main | `{ path, tsxContent, cssContent }` |
| `file:patch` | renderer → main | `{ cssPath, classname, newDeclarations }` |
| `file:changed` | main → renderer | `{ path, tsxContent, cssContent }` |
| `project:create` | renderer → main | `{ folderPath, name }` |
| `page:create` | renderer → main | `{ projectPath, pageName }` |
| `page:delete` | renderer → main | `{ projectPath, pageName }` |

`file:patch` is used by the panel editor — it sends the new declaration text for a single class, and the main process uses postcss to replace just that block, leaving the rest of the CSS module untouched.

`file:write` is used by the canvas — it sends both full files after a canvas state change.

---

## Zustand State Shape

```ts
interface AppState {
  // Project
  projectPath: string | null;
  projectName: string | null;

  // Pages
  pages: Page[];
  activePage: string | null;

  // Scamp
  elements: Record<string, Element>; // flat map, keyed by element ID
  rootElementId: string | null;
  selectedElementId: string | null;

  // UI
  activeTool: 'select' | 'rectangle' | 'text';
  bottomPanel: 'code' | 'terminal' | 'both' | 'none';
}

interface Element {
  id: string;                        // e.g. "a1b2" — stable, used in class name + data-scamp-id
  type: 'rectangle' | 'text';
  parentId: string | null;
  childIds: string[];

  // Sizing
  widthMode: 'fixed' | 'stretch';
  widthValue: number;
  heightMode: 'fixed' | 'stretch';
  heightValue: number;

  // Position (absolute within parent for POC)
  x: number;
  y: number;

  // Flex (as container)
  display: 'none' | 'flex';
  flexDirection: 'row' | 'column';
  gap: number;
  alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  padding: [number, number, number, number];

  // Appearance
  backgroundColor: string;
  borderRadius: number;
  borderWidth: number;
  borderStyle: 'none' | 'solid' | 'dashed' | 'dotted';
  borderColor: string;

  // Text only
  text?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';

  // Passthrough — properties the canvas can't map, preserved verbatim
  customProperties: Record<string, string>;
}
```

---

## The Two Core Functions

### `generateCode(elements, rootId, pageName) → { tsx: string, css: string }`

- Traverses element tree depth-first, recursively building JSX
- Each element emits `data-scamp-id` and `className={styles.[type]_XXXX}` where type is `rect` or `text` (or `styles.root`)
- Only emits CSS properties that differ from `DEFAULT_ELEMENT_STYLES`
- Always emits `customProperties` verbatim at the end of the class block
- Text content is HTML-escaped before insertion
- Result is debounced 200ms before the `file:write` IPC call

### `parseCode(tsx: string, css: string) → ElementTree`

- TSX pass: uses htmlparser2 to extract element tree from `data-scamp-id` and class name attributes
- CSS pass: uses postcss to extract per-class property declarations
- Runs each property through `cssToScampProperty` map; unmapped properties go to `customProperties`
- Applies `DEFAULT_ELEMENT_STYLES` as baseline before overlaying parsed values
- Returns a flat `Record<string, Element>` keyed by element ID
- Called after every chokidar file change; result is diffed before updating Zustand

Shorthand parsing helpers (`parseBorderShorthand`, `parsePaddingShorthand`) handle both shorthand and longhand forms so agent-written or user-written CSS is parsed correctly regardless of format. These are the most edge-case-prone functions and should be tested thoroughly.

---

## Milestones

### M1 — Electron shell + file system (Week 1)
- [x] Scaffold with `electron-vite` + React + TypeScript
- [x] Native open/create folder dialogs wired up
- [x] IPC channels for read/write/patch/watch implemented
- [x] chokidar watcher in main process → `file:changed` to renderer
- [x] Recent projects stored and displayed on start screen
- [x] `agent.md` auto-generated on project create

### M2 — Scamp + rectangle drawing (Week 2)
- [x] Viewport renders inside the app, scaled correctly
- [x] Rectangle tool: click-drag to create
- [x] Select tool: click to select, drag to move, handles to resize
- [x] Nested rectangles: draw inside a selected rectangle
- [x] Zustand state wired to canvas DOM rendering

### M3 — Core functions + panel editor (Week 2–3)
- [x] `generateCode()` implemented with unit tests
- [x] `parseCode()` implemented with unit tests including shorthand parsing
- [x] Debounced write on canvas state change via `file:write`
- [x] CodeMirror panel editor loads selected element's class body
- [x] Panel commit triggers `file:patch` → chokidar → `parseCode()` → state update → panel reload
- [x] Round-trip confirmed: edit in panel → file updates → panel reloads with parsed result

### M4 — Code panel + external sync (Week 3)
- [x] Code panel renders live TSX + CSS with syntax highlighting
- [x] chokidar detects external file changes (agent edits)
- [x] `parseCode()` runs on change → canvas re-renders
- [x] Panel reloads for selected element if its class changed
- [x] `customProperties` shown in panel with ⚠ label for unmapped properties

### M5 — Text + terminal (Week 4)
- [x] Text tool: click to place, double-click to edit (contentEditable)
- [x] Text properties editable via CSS panel (font-size, color, etc.)
- [x] `node-pty` + `xterm.js` terminal panel wired up
- [x] Terminal opens in project folder automatically
- [x] End-to-end test: design in canvas → agent edits file → canvas and panel reload

---

## Success Criteria for POC

The POC is complete when all of the following work in a single uninterrupted flow:

1. User creates a new project, picks a folder
2. Draws 3 nested rectangles on the canvas
3. Selects a rectangle — its class body loads in the CodeMirror panel
4. Types `display: flex; gap: 16px; background: #f0f0f0;` in the panel, commits
5. Scamp updates to reflect the new styles
6. Adds a text element, styles it via the panel
7. Opens the code panel — sees valid, readable TSX + CSS matching the canvas
8. Opens the terminal, runs a coding agent, asks it to change a background color
9. Scamp and panel update automatically without any manual refresh

If step 9 works, the bidirectional sync loop is validated and the POC is done.

---

## Open Questions

- **Positioning model:** POC uses `position: absolute` for elements within a parent. This works but produces messy CSS output. The question of whether to move to a flex-only positioning model (where freeform placement is not allowed) should be revisited after the POC — it's a fundamental UX decision about how structured vs. freeform the tool should be.

- **Re-parse on canvas state vs. file:** Currently, the canvas state is the source of truth for canvas changes, and files are the source of truth for external changes. If both change simultaneously (unlikely but possible), the last write wins. A simple lock flag during the canvas write debounce window is enough for the POC.

- **CodeMirror as permanent feature:** The raw CSS panel is scoped as a POC testing tool, but it's likely worth keeping permanently as a "CSS" tab alongside future WYSIWYG controls. Power users will want it.
