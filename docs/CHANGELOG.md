# Changelog

Everything Scamp does, and when it arrived.

This document has two parts, because they answer different questions:

- **[Releases](#releases)**: What changed in each version, newest first.
- **[Feature inventory](#feature-inventory)**: The complete list of what
  Scamp can do today, grouped by area, with no version attached.

The inventory exists because release attribution isn't reliable for the
early history. The bulk of the app shipped inside the first tagged build
(`v0.4.0`), and commit messages from that period are often a few words,
such as "added components" and "colorpicker". Rather than guess which
build a feature landed in, the inventory lists it plainly, and the
release notes cover what can be traced.

Dates are the tag dates. Versions follow the `package.json` version at
release time.

---

## Releases

### 0.7.0 (2026-09-08)

Electron 44, the full flex vocabulary in the panel, a Transform section,
and better guidance for coding agents.

**Added**

- **Every flex control, in the Layout and Size sections.** Layout gains
  **Wrap**, a **Reverse** toggle on its own row, **Align content**, and
  separate **Row gap** and **Column gap** inputs. When an element sits in
  a flex container, the Size section gains an **Advanced** disclosure
  with **Grow**, **Shrink**, **Don't shrink**, **Basis**, **Align self**,
  and **Order**. Everything is written as longhand CSS, and hand-written
  flex CSS round-trips back into the panel, including the `flex`
  shorthand. Drawing a box into a flex container, or typing a pixel size
  on its main axis, turns **Don't shrink** on so the box keeps the size
  you gave it. See [Flex layout](user_docs/flex-layout.md).
- **A Transform section.** Add translate, rotate, scale, and skew
  functions in order, and set the transform origin from nine presets or
  any CSS value. Hand-written `transform` lists parse into the same rows.
  See [Transforms](user_docs/transforms.md).
- **Agents learn to create Scamp components.** The MCP server now
  describes itself on connect, and a new `scamp_get_component_scaffold`
  tool hands an agent the exact starter files for a component, so it
  writes real component folders instead of a page of examples.
  `agent.md` gains a Scamp components section and page conventions.
- **The MCP indicator says what's wrong.** The dot in the terminal header
  is gray until an agent connects, green after one has, and amber when
  Claude Code has the server disabled for this project because you
  declined its prompt. In the amber state the copy button copies the
  command that brings the prompt back. See
  [Work with AI agents](user_docs/ai-agents.md).
- **A Linux page in the user docs** that explains the Wayland behavior
  below and how to opt out. See [Linux](user_docs/linux.md).

**Changed**

- **Electron 31 to 44**, with electron-vite 5, Vite 7, and Node 24. The
  clipboard and folder pickers are updated for the new APIs: choosing a
  project folder now starts from your default projects folder and
  remembers the last pick, rather than opening on Downloads.
- **On Linux, Scamp runs through XWayland by default.** Electron 44
  crashes on startup under the native Wayland backend on some systems,
  so Scamp asks for X11 and restarts itself once at launch. Set
  `SCAMP_OZONE_PLATFORM=auto` to opt back into native Wayland.
- **User docs and this changelog follow the Google developer
  documentation style guide.** Sentence-case headings, second person,
  present tense, and task headings as imperatives.

**Fixed**

- **Long page and component lists scroll inside their sidebar section**,
  the way the layers list does, instead of scrolling the whole window.
- **Saving from the CSS panel with Cmd+S no longer pauses sync.** The
  app's own write was being reported back as an external edit, which
  showed a "nothing was saved" warning and paused syncing until the
  quiet window passed.
- **Component instances fill at every breakpoint.** An instance whose
  width was set to Fill at the Mobile breakpoint stayed at its desktop
  size on the canvas, while the preview filled correctly. The canvas now
  resolves the component's elements at the active breakpoint.

### 0.6.6 (2026-08-31)

**Fixed**

- **Clicking an element inside a flex or grid container no longer moves
  it.** Selecting one could send it to the end of its container, and
  selecting the last one could lift it out into a sibling, because a
  plain click was running the whole drag gesture. A mouse click emits no
  movement, but a trackpad tap emits a pixel or two of jitter, which was
  enough to resolve and commit a drop. Dragging now starts only after
  the pointer has traveled, so a click selects and nothing else. The
  same gap let a click near a container's edge reparent an absolutely
  positioned element; that's closed too.

### 0.6.5 (2026-08-29)

Sign-in arrives, the start screen gets a visual refresh, and the canvas
starts rendering your page's real stylesheet instead of an approximation
of it.

**Added**

- **Sign in to a Scamp account.** An account panel sits at the bottom of
  the start-screen sidebar. Signing in opens your browser, you approve
  there, and the app picks up the result on its own. When you're signed
  in, the panel shows your name, email address, and a sign-out link.
  Everything is optional: Scamp works exactly the same signed out, never
  prompts you on launch, and there's nothing to dismiss. Your session
  lasts 30 days and renews whenever you use it, so it expires from
  disuse rather than on a clock. If your OS can't store the sign-in
  securely, the panel tells you so rather than quietly forgetting you.
  See [Accounts](user_docs/accounts.md).
- **Project thumbnails on the start screen.** Each card shows a picture
  of the project's home page, recaptured whenever you save. Projects
  without one show their artboard color in the same space, so the grid
  stays even. Thumbnails live in `<project>/.scamp/preview.png`.
- **A refreshed start screen.** New project cards; the default projects
  folder moved from a block of sidebar chrome to a folder icon beside
  the **Projects** heading (hold the pointer over it for the path, and
  click to change it); and project names shown the way you read them.
  `my-portfolio` displays as "My Portfolio", with the folder name still
  shown on hover and used unchanged on disk. **"Last opened" now stays
  readable past a day.** It steps through minutes, hours, days, weeks,
  months, and years, where a project opened last week previously showed
  a bare "14:32" with no date.
- **The canvas renders your page's real stylesheet.** `::before` and
  `::after`, `:nth-child`, and any hand-written selector now appear on
  the canvas. Previously they were parsed, preserved, and written back
  to your files, yet stayed invisible while you designed. That mattered
  most for agent-written CSS, because `agent.md` recommends `::before`
  for decorative touches. Component instances get their own scoped copy,
  so one instance's styles can't leak into another or into the page
  around them.
- **Breakpoints resolve against the artboard**, not the app window. A
  390 px frame now fires your mobile breakpoint no matter how wide the
  Scamp window is, so what you see at each size is what a browser at
  that size does.
- **Export a project as HTML.** A new **Export HTML** button in the
  project header writes every page as plain `.html` and `.css` files
  into a folder you choose, with no build step and no dependencies.
  Pages keep their routes (`about/index.html`), links between them are
  rewritten to work both on a static host and straight off disk, images
  are copied into `assets/`, and `theme.css` comes along so every token
  still resolves. Component instances are flattened into ordinary
  markup, each with its own copy of the component's styles, so
  per-instance sizing and text survive. You pick a location, and Scamp
  creates a folder there named after the project. Re-exporting reuses
  it, and a name held by anything Scamp didn't write is stepped over
  rather than overwritten. The button reports progress and the result: a
  spinner while writing, a green count when it lands, and a red **Export
  failed** with the reason on hover, so an export that declines to run
  can't be mistaken for one that did nothing.
- **Semantic color tokens accept a literal value.** A semantic row could
  only be pointed at a primitive; a hand-written value showed as
  "— custom —" and couldn't be edited. Rows now use the same color
  control as the properties panel, so you can map to a primitive, type
  a value, or use the picker and eyedropper. The picker offers
  primitives only, because pointing one semantic token at another would
  put a reference cycle two clicks away.
- **An image's Source is editable.** It was a read-only filename, and
  the only way to change it was **Replace**, which imports from your
  assets, so there was no route to an image you hadn't imported,
  including one at an absolute URL. It's now a text field that commits
  on Enter or blur.

**Changed**

- **Scamp runs as a single instance.** Opening it again focuses the
  window you already have rather than starting a second copy. Sign-in
  requires this, because it needs one known place for the browser to
  hand its result back to.
- **The Image section moved** to directly after Element in the
  properties panel, matching what Typography already does for text. The
  thing you opened the panel for now leads the style sections. It used
  to sit twelfth, below Background, Border, Shadows, and Filters.
- **Background no longer offers "Set background image" on an `<img>`**,
  where it read as a second source competing with the element's own. It
  still appears if a background image is already set, so one added
  elsewhere stays removable, and it's untouched for every other element.

**Fixed**

- **Boxes drawn inside a flex or grid container keep the size you
  drew.** They were being clamped against the parent, so a box drawn to
  fill a container came out smaller than the drag that made it.
- **Fill height works in a flex row.** It emitted `height: 100%`, which
  resolves against an `auto`-height container and computed to zero, so
  the element vanished. It now emits `align-self: stretch`, and the Size
  panel still reads **Fill**.
- **Links and buttons keep your page's styles.** The canvas reset for
  semantic tags was overriding styling you set on `<a>` and `<button>`.
- **Duplicate CSS declarations are still flagged when they change
  nothing.** A property repeated with the same winning value produced
  identical code, so the warning was dropped, which is exactly the case
  where the duplicate has no other symptom to notice it by.
- **Animated elements no longer stretch the artboard.** Mid-animation
  positions were being counted as canvas extent, so the scrollable area
  grew and shrank while an animation played.
- **`position: absolute` survives on a flex or grid child.** It was
  being discarded on parse and then deleted from your file on the next
  save.
- **`position: sticky` renders at rest on the canvas.** A real sticky
  element stuck to the canvas viewport, so it drifted away from where it
  sits in the page as you panned, and its coordinates were read as
  scroll offsets. Your generated CSS is unchanged; this affects only the
  canvas.
- **Grid gaps round-trip** through the shorthand without drifting.
- **Gradient backgrounds render on the canvas**, not only in preview.
- **Tooltips raised by a click no longer stick open.**
- **Sign-in's loopback listener no longer hangs** when closing.

### 0.6.0 (2026-08-19)

A batch of editing improvements, plus image compression on import.

**Added**

- **Collapse branches in the layers tree.** A disclosure triangle
  appears on any element with children. **Alt+click** folds or unfolds
  the whole branch at once. A collapsed row shows a dot when your
  selection is hidden inside it, and selecting on the canvas expands
  whatever the element is nested in. The state is session-only: it's
  never written to project files, and it resets when you switch page or
  component.
- **Cut, multi-select copy, and paste positioning.** **Cmd+X** cuts as a
  single undo step, **Cmd+C** copies a multi-selection, **Cmd+Shift+V**
  pastes in place at the copied coordinates, and right-clicking and
  selecting **Paste** drops at the clicked point. Copy, Cut, and Paste
  are added to the element right-click menu. Copying with the page
  selected takes everything on it.
- **Duplicates keep their name.** `menu_a1b2` duplicates to `menu_c3d4`
  instead of reverting to `rect_c3d4`, recursively for named children.
  **Duplicate** is added to the right-click menu.
- **Images are compressed on import.** PNG and JPEG are re-encoded to
  WebP, and anything larger than 3000 px on its longest edge is scaled
  down to fit. A 7 MB camera photo typically lands under 500 KB. SVGs
  and existing WebP files are left alone, and the original is kept
  whenever converting wouldn't make it smaller.
- **Anonymous usage counting**, off unless you opt in. A random ID
  generated on your machine identifies the installation, not you.
  Opting out deletes it. Toggle it in **Settings > Privacy**.

**Changed**

- **Drop targeting is unambiguous.** The middle of a container means
  "inside it", and its leading and trailing edges mean "beside it". One
  shared rule applies to both the canvas and the layers tree. The
  destination container is outlined during the drag, and grid
  containers behave exactly like flex ones.
- **Cmd+V now offsets** from the copied position rather than pasting at
  the exact coordinates. **Cmd+Shift+V** is the paste in place.
- **Image conversion runs in a child process**, so a large import never
  freezes the app. An "Optimizing image…" indicator appears over the
  container it's landing in.

**Fixed**

- Choosing an image that's already in your assets folder links it
  instead of making a duplicate copy each time.
- Grid children can be reordered by dragging. Previously only flex
  children could. A grid child fell through to the absolute-move path,
  where dragging did nothing and only siblings highlighted.
- Pasting with a text, image, or input selected no longer nests the
  pasted element inside it.
- The layers tree no longer offers "drop inside" for images, inputs, and
  component instances.
- `npm run test:unit` and `npm run test:integration` were matching zero
  files and exiting as if nothing needed running.

### 0.5.7 (2026-08-10)

- **MCP server**, so coding agents can query the live canvas: the open
  page, the element tree, selection, theme tokens, and breakpoints.
- **Live context file** kept up to date on disk for agents that read
  files rather than call tools.
- **Copy context for agent** on the element right-click menu.
- Code panel improvements, including highlighting the selected element
  in the TSX and CSS.
- User docs for the AI agent features.

### 0.5.6 (2026-07-31)

- Component bug fixes.

### 0.5.5 (2026-07-28)

- Color and token picker polish, and a semantic picker in the theme
  builder.

### 0.5.4 (2026-07-27)

- Element tree menu updates.
- Theme and font upgrades.
- Card view for the project list.

### 0.5.3 (2026-07-27)

- Fixed a duplicate element-ID issue.
- Design cleanup on the layout controls.

### 0.5.2 (2026-07-24)

- **Design system panel**: The token editor moved into the main frame,
  navigation moved to the sidebar, and palette and theme work landed.

### 0.5.1 (2026-07-17)

- Fixed canvas sizing inside components.

### 0.5.0 (2026-07-16)

- **Component slots**: Instances can take page-owned content.
- SVG improvements.
- Aspect-ratio lock and canvas overflow controls.

### 0.4.7 (2026-07-13)

- Zoom control cleanup.

### 0.4.6 (2026-07-09)

- Fixed a CSP issue that blocked crash reporting.

### 0.4.5 (2026-07-06)

- Inline SVGs render as real `<svg>` on the canvas, recolor reliably,
  and are click-selectable and labeled in the layers tree.

### 0.4.4 (2026-06-25)

- **Drag to reparent** on the canvas, into absolute containers and into
  flex and grid containers at an insert position.

### 0.4.3 (2026-06-24)

- Fixed a stuck snapshot-preview lock when canvas content is replaced.

### 0.4.2 (2026-06-24)

- The updater shows the real error, and the app version is added to
  Settings.

### 0.4.1 (2026-06-24)

- Components no longer inherit the page root's `100vh` floor.

### 0.4.0 (2026-06-23)

First tagged release. Contains the bulk of the app; see the
[feature inventory](#feature-inventory) for the full list. Notable
capabilities that landed in this window: the canvas and element model,
bidirectional file sync, components, the color picker and color tokens,
breakpoints, element states, animations and transitions, CSS grid,
export to PNG and SVG, preview mode, snapshots and the history panel,
typography tokens, crash reporting, automatic updates, and Windows and
macOS packaging.

---

## Feature inventory

Everything Scamp does today. Each entry links to its user documentation.

### Canvas and elements

- Draw rectangles, text, images, and form inputs; select, move, resize,
  and nudge with arrow keys. [Canvas](user_docs/canvas.md)
- Change an element's HTML tag without breaking its CSS class, plus
  tag-specific attributes, `<select>` and `<option>`, and inline SVG.
  [Elements](user_docs/elements.md)
- Rename elements; names become the CSS class prefix
  (`hero_card_a1b2`). [Element naming](user_docs/element-naming.md)
- Duplicate, copy, cut, and paste, including across pages and at a
  chosen point. [Canvas](user_docs/canvas.md)
- Group and ungroup into flex containers.
  [Grouping](user_docs/grouping.md)
- Canvas size presets and custom widths, content clipping, and an
  overflow indicator. [Canvas](user_docs/canvas.md)
- Link elements to other pages or external URLs.
  [Link between pages](user_docs/linking.md)

### Layout

- Flex containers with direction, wrap, gap, alignment, and
  justification, plus flex-child controls.
  [Flex layout](user_docs/flex-layout.md)
- CSS Grid containers with column and row tracks and per-item
  placement. [Grid layout](user_docs/grid-layout.md)
- Drag to reparent and reorder on the canvas and in the layers tree,
  with drop-target feedback. [Layers panel](user_docs/layers-panel.md)
- Aspect-ratio lock on resize. [Canvas](user_docs/canvas.md)

### Styling

- Visual and raw-CSS editing modes.
  [Properties panel](user_docs/properties-panel.md)
- Color picker with alpha, hex entry, project swatches, and theme
  tokens. [Color picker](user_docs/color-picker.md)
- Typography: fonts, size, weight, line height, and letter spacing.
  [Typography](user_docs/typography.md)
- Box shadows, blend modes, and CSS filters, including backdrop filters.
  [Filters](user_docs/filters.md)
- CSS transforms with a transform origin.
  [Transforms](user_docs/transforms.md)
- Hover, active, and focus styles through the state switcher.
  [Element states](user_docs/element-states.md)
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
  [Design system](user_docs/design-system.md)
- Color palettes (primitives) and semantic color tokens.
  [Colors](user_docs/colors.md)
- Type scale and reusable text styles.
  [Text styles](user_docs/text-styles.md)
- Spacing, border width, radius, and shadow tokens.
  [Design tokens](user_docs/design-tokens.md)
- Light, dark, and custom themes.
  [Themes](user_docs/themes.md)
- An auto-generated `DESIGN.md` that describes the system for agents.
  [DESIGN.md](user_docs/design-md.md)

### Code output and sync

- Real TSX and CSS Module files written as you design, with save status
  and a live code preview.
  [Code output](user_docs/code-output.md)
- Bidirectional sync: edit the files externally, and the canvas reloads.
  [Bidirectional sync](user_docs/bidirectional-sync.md)
- Next.js and legacy project formats.
  [Get started](user_docs/getting-started.md)

### Work with AI agents

- An MCP server that exposes the live canvas to coding agents.
- A live context file on disk for file-reading agents.
- **Copy context for agent** for pasting into a chat or terminal.
  [Work with AI agents](user_docs/ai-agents.md)

### Project management

- Pages: create, rename, delete, and navigate.
- Per-page undo and redo, plus a visual History panel.
  [Undo, redo, and history](user_docs/undo-redo.md)
- Snapshots: durable point-in-time backups you can preview and restore.
  [Snapshots](user_docs/snapshots.md)
- A start screen with recent and discovered projects, shown as cards
  with a thumbnail of each project's home page.
  [Get started](user_docs/getting-started.md)

### Output and preview

- Export the page or a selected element as PNG or SVG.
  [Export](user_docs/export.md)
- Preview mode running a real Next.js dev server.
  [Preview mode](user_docs/preview.md)
- Images compressed to WebP on import, with oversized photos scaled to
  fit. [Elements](user_docs/elements.md)
- Export the whole project as a folder of static HTML and CSS.
  [Export](user_docs/export.md)

### The app itself

- A built-in terminal panel. [Terminal](user_docs/terminal.md)
- App and per-project settings, including the privacy toggle.
  [Settings](user_docs/settings.md)
- Optional sign-in to a Scamp account, with the session stored in your
  OS's secure storage. Every feature works signed out.
  [Accounts](user_docs/accounts.md)
- Automatic updates, and opt-in anonymous crash reporting.
- Complete keyboard shortcuts.
  [Keyboard shortcuts](user_docs/keyboard-shortcuts.md)
- Linux-specific display behavior and the Wayland opt-out.
  [Linux](user_docs/linux.md)
