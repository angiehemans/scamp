# Changelog

Everything Scamp does, and when it arrived.

This has two parts, because they answer different questions:

- **[Releases](#releases)** — what changed in each version, newest first.
- **[Feature inventory](#feature-inventory)** — the complete list of what
  Scamp can do today, grouped by area, with no version attached.

The inventory exists because release attribution isn't reliable for the
early history: the bulk of the app shipped inside the first tagged build
(`v0.4.0`), and commit messages from that period are often a few words
("added components", "colorpicker"). Rather than guess which build a
feature landed in, the inventory lists it plainly and the release notes
cover what can be traced.

Dates are the tag dates. Versions follow the `package.json` version at
release time.

---

## Releases

### Unreleased

Nothing yet.

### 0.6.0 — 2026-08-19

A batch of editing improvements, plus image compression on import.

**Added**

- **Collapse branches in the layers tree.** A disclosure triangle on any
  element with children; **Alt+click** folds or unfolds the whole branch
  at once. A collapsed row shows a dot when your selection is hidden
  inside it, and selecting on the canvas expands whatever the element is
  nested in. Session-only — never written to project files, and reset
  when you switch page or component.
- **Cut, multi-select copy, and paste positioning.** **Cmd+X** cuts as a
  single undo step; **Cmd+C** copies a multi-selection; **Cmd+Shift+V**
  pastes in place at the copied coordinates; right-click → **Paste**
  drops at the clicked point. Copy, Cut, and Paste added to the element
  right-click menu. Copying with the **page** selected takes everything
  on it.
- **Duplicates keep their name.** `menu_a1b2` duplicates to `menu_c3d4`
  instead of reverting to `rect_c3d4`, recursively for named children.
  Right-click → **Duplicate** added.
- **Images are compressed on import.** PNG and JPEG are re-encoded to
  WebP, and anything larger than 3000px on its longest edge is scaled
  down to fit. A 7MB camera photo typically lands under 500KB. SVGs and
  existing WebP files are left alone, and the original is kept whenever
  converting wouldn't make it smaller.
- **Anonymous usage counting**, off unless you opt in. A random ID
  generated on your machine identifies the installation, not you; opting
  out deletes it. Toggle in **Settings → Privacy**.

**Changed**

- **Drop targeting is unambiguous.** The middle of a container means
  "inside it", its leading and trailing edges mean "beside it" — one
  shared rule for both the canvas and the layers tree. The destination
  container is outlined during the drag, and grid containers behave
  exactly like flex ones.
- **Cmd+V now offsets** from the copied position rather than pasting at
  the exact coordinates; **Cmd+Shift+V** is the paste-in-place.
- **Image conversion runs in a child process**, so a large import never
  freezes the app, with an "Optimising image…" indicator over the
  container it's landing in.

**Fixed**

- Choosing an image that's **already in your assets folder** links it
  instead of making a duplicate copy each time.
- **Grid children can be reordered** by dragging. Previously only flex
  children could — a grid child fell through to the absolute-move path,
  where dragging did nothing and only siblings highlighted.
- Pasting with a **text, image, or input selected** no longer nests the
  pasted element inside it.
- The layers tree no longer offers **"drop inside"** for images, inputs,
  and component instances.
- `npm run test:unit` and `npm run test:integration` were matching zero
  files and exiting as if nothing needed running.

### 0.5.7 — 2026-08-10

- **MCP server** so coding agents can query the live canvas — the open
  page, the element tree, selection, theme tokens, and breakpoints.
- **Live context file** kept up to date on disk for agents that read
  files rather than call tools.
- **Copy context for agent** on the element right-click menu.
- Code panel improvements, including highlighting the selected element
  in the TSX and CSS.
- User docs for the AI agent features.

### 0.5.6 — 2026-07-31

- Component bug fixes.

### 0.5.5 — 2026-07-28

- Color and token picker polish; semantic picker in the theme builder.

### 0.5.4 — 2026-07-27

- Element tree menu updates.
- Theme and font upgrades.
- Card view for the project list.

### 0.5.3 — 2026-07-27

- Fixed a duplicate element-ID issue.
- Design cleanup on the layout controls.

### 0.5.2 — 2026-07-24

- **Design system panel**: token editor moved into the main frame,
  navigation moved to the sidebar, palette and theme work.

### 0.5.1 — 2026-07-17

- Fixed canvas sizing inside components.

### 0.5.0 — 2026-07-16

- **Component slots** — instances can take page-owned content.
- SVG improvements.
- Aspect-ratio lock and canvas overflow controls.

### 0.4.7 — 2026-07-13

- Zoom control cleanup.

### 0.4.6 — 2026-07-09

- Fixed a CSP issue blocking crash reporting.

### 0.4.5 — 2026-07-06

- Inline SVGs render as real `<svg>` on canvas, recolor reliably, and are
  click-selectable and labeled in the layers tree.

### 0.4.4 — 2026-06-25

- **Drag to reparent** on the canvas — into absolute containers, and into
  flex/grid containers at an insert position.

### 0.4.3 — 2026-06-24

- Fixed a stuck snapshot-preview lock when canvas content is replaced.

### 0.4.2 — 2026-06-24

- Updater shows the real error; app version added to Settings.

### 0.4.1 — 2026-06-24

- Components no longer inherit the page root's `100vh` floor.

### 0.4.0 — 2026-06-23

First tagged release. Contains the bulk of the app — see the
[feature inventory](#feature-inventory) for the full list. Notable
capabilities that landed in this window: the canvas and element model,
bidirectional file sync, components, the color picker and color tokens,
breakpoints, element states, animations and transitions, CSS grid,
export to PNG/SVG, preview mode, snapshots and the history panel,
typography tokens, crash reporting, auto-updates, and Windows/macOS
packaging.

---

## Feature inventory

Everything Scamp does today. Each entry links to its user documentation.

### Canvas and elements

- Draw rectangles, text, images, and form inputs; select, move, resize,
  and nudge with arrow keys. [Canvas](user_docs/canvas.md)
- Change an element's HTML tag without breaking its CSS class, plus
  tag-specific attributes, `<select>`/`<option>`, and inline SVG.
  [Elements](user_docs/elements.md)
- Rename elements; names become the CSS class prefix
  (`hero_card_a1b2`). [Element Naming](user_docs/element-naming.md)
- Duplicate, copy, cut, and paste — including across pages and at a
  chosen point. [Canvas](user_docs/canvas.md)
- Group and ungroup into flex containers.
  [Grouping](user_docs/grouping.md)
- Canvas size presets and custom widths, content clipping, and an
  overflow indicator. [Canvas](user_docs/canvas.md)
- Link elements to other pages or external URLs.
  [Linking](user_docs/linking.md)

### Layout

- Flex containers with direction, gap, alignment, and justification.
  [Properties Panel](user_docs/properties-panel.md)
- CSS Grid containers with column and row tracks and per-item
  placement. [Grid Layout](user_docs/grid-layout.md)
- Drag to reparent and reorder on the canvas and in the layers tree,
  with drop-target feedback. [Layers Panel](user_docs/layers-panel.md)
- Aspect-ratio lock on resize. [Canvas](user_docs/canvas.md)

### Styling

- Visual and raw-CSS editing modes.
  [Properties Panel](user_docs/properties-panel.md)
- Color picker with alpha, hex entry, project swatches, and theme
  tokens. [Color Picker](user_docs/color-picker.md)
- Typography: fonts, size, weight, line height, letter spacing.
  [Typography](user_docs/typography.md)
- Box shadows, blend modes, and CSS filters including backdrop filters.
  [Filters](user_docs/filters.md)
- Hover, active, and focus styles via the State Switcher.
  [Element States](user_docs/element-states.md)
- Transitions between states.
  [Transitions](user_docs/transitions.md)
- Preset keyframe animations with full timing control.
  [Animations](user_docs/animations.md)

### Responsive design

- Per-breakpoint overrides, with the canvas switching to the
  breakpoint's width. [Breakpoints](user_docs/breakpoints.md)

### Components

- Reusable components shared across pages, with a dedicated editor.
- Slots for page-owned content, and per-instance text overrides.
- Detach an instance back into plain elements.
  [Components](user_docs/components.md)

### Design system

- The Design System panel, backed by a real `theme.css`.
  [Design System](user_docs/design-system.md)
- Color palettes (primitives) and semantic color tokens.
  [Colors](user_docs/colors.md)
- Type scale and reusable text styles.
  [Text Styles](user_docs/text-styles.md)
- Spacing, border width, radius, and shadow tokens.
  [Design Tokens](user_docs/design-tokens.md)
- Light, dark, and custom themes.
  [Themes](user_docs/themes.md)
- An auto-generated `DESIGN.md` describing the system for agents.
  [DESIGN.md](user_docs/design-md.md)

### Code output and sync

- Real TSX and CSS Module files written as you design, with save
  status and a live code preview.
  [Code Output](user_docs/code-output.md)
- Bidirectional sync: edit the files externally and the canvas reloads.
  [Bidirectional Sync](user_docs/bidirectional-sync.md)
- Next.js and legacy project formats.
  [Getting Started](user_docs/getting-started.md)

### Working with AI agents

- An MCP server exposing the live canvas to coding agents.
- A live context file on disk for file-reading agents.
- **Copy context for agent** for pasting into a chat or terminal.
  [Working with AI Agents](user_docs/ai-agents.md)

### Project management

- Pages: create, rename, delete, and navigate.
- Per-page undo/redo plus a visual History panel.
  [Undo, Redo, and History](user_docs/undo-redo.md)
- Snapshots — durable point-in-time backups you can preview and
  restore. [Snapshots](user_docs/snapshots.md)
- Start screen with recent and discovered projects.
  [Getting Started](user_docs/getting-started.md)

### Output and preview

- Export the page or a selected element as PNG or SVG.
  [Export](user_docs/export.md)
- Preview mode running a real Next.js dev server.
  [Preview Mode](user_docs/preview.md)
- Images compressed to WebP on import, with oversized photos scaled to
  fit. [Elements](user_docs/elements.md)

### The app itself

- A built-in terminal panel. [Terminal](user_docs/terminal.md)
- App and per-project settings, including the privacy toggle.
  [Settings](user_docs/settings.md)
- Automatic updates, and opt-in anonymous crash reporting.
- Complete keyboard shortcuts.
  [Keyboard Shortcuts](user_docs/keyboard-shortcuts.md)
