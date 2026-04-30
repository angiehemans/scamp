# Scamp — Feature Backlog v3

User stories ordered easiest to hardest.

---

## 1. Transitions - DONE

**User story**

As a user designing interactive elements, I want to add CSS transitions to any
element from the WYSIWYG panel so hover states and property changes animate
smoothly without having to write the CSS manually.

**Behaviour**

- A "Transitions" section appears in the WYSIWYG panel for every selected element
- Controls:

  | Control | Type | Default |
  |---|---|---|
  | Property | Dropdown: all, opacity, transform, background, color, border, width, height | all |
  | Duration | Number input + unit toggle (ms / s) | 200ms |
  | Easing | Dropdown: ease, linear, ease-in, ease-out, ease-in-out, custom cubic-bezier | ease |
  | Delay | Number input + unit toggle (ms / s) | 0ms |

- Multiple transitions can be added per element — a small "+ Add transition" button
  appends another row
- Each row has a remove button
- Output is a single `transition` shorthand property per element:
  ```css
  transition: opacity 200ms ease, transform 300ms ease-in-out;
  ```
- Transitions round-trip through `parseCode` — both shorthand and longhand
  forms parsed back correctly
- Custom cubic-bezier opens a simple four-point input: `cubic-bezier(0.4, 0, 0.2, 1)`

**Notes**

- Transitions only have visible effect in the canvas when combined with hover/active
  states (story 3) or when properties change programmatically — they won't
  animate in the static canvas viewport but will be visible in preview mode
  (story 5)
- The parser needs to handle the `transition` shorthand carefully — it is one
  of the more complex CSS shorthands to decompose reliably

---

## 2. CSS Grid layout - DONE

**User story**

As a user building complex layouts, I want to set an element's display to grid
and define columns, rows, and gaps from the WYSIWYG panel so I can design
grid-based layouts without writing CSS manually.

**Behaviour**

- The layout section of the WYSIWYG panel gains a display option: None / Flex /
  Grid
- When Grid is selected the flex controls are replaced with grid controls:

  | Control | Type | Notes |
  |---|---|---|
  | Columns | Text input | Accepts any valid `grid-template-columns` value: `1fr 1fr`, `repeat(3, 1fr)`, `200px 1fr` etc. |
  | Rows | Text input | Accepts any valid `grid-template-rows` value |
  | Column gap | Number input (px) | Maps to `column-gap` |
  | Row gap | Number input (px) | Maps to `row-gap` |
  | Align items | Segmented: Start / Center / End / Stretch | Maps to `align-items` |
  | Justify items | Segmented: Start / Center / End / Stretch | Maps to `justify-items` |

- Grid child controls — when an element is a direct child of a grid container,
  additional controls appear in the sizing section:

  | Control | Type | Notes |
  |---|---|---|
  | Column span | Text input | `grid-column: span 2` or explicit `1 / 3` |
  | Row span | Text input | `grid-row: span 2` or explicit `1 / 3` |
  | Align self | Segmented: Start / Center / End / Stretch | |
  | Justify self | Segmented: Start / Center / End / Stretch | |

- The canvas renders grid containers correctly — child elements are laid out
  by the browser's grid engine, the same as flex
- Grid lines are shown as a subtle overlay on the canvas when a grid container
  is selected — dashed lines showing columns and rows

**Notes**

- Grid template values are free-text inputs rather than visual column builders
  because the range of valid values is too broad to constrain to a simple UI —
  power users will want `minmax`, `auto-fill`, `auto-fit` etc.
- The `parseCode` property map needs entries for all grid properties:
  `display: grid`, `grid-template-columns`, `grid-template-rows`,
  `column-gap`, `row-gap`, `grid-column`, `grid-row`, `align-items`,
  `justify-items`, `align-self`, `justify-self`
- Auto-placement (implicit grid) is supported by default since it's just CSS —
  no special handling needed

---

## 3. Per-element states (hover, active, focus)

**User story**

As a user designing interactive elements, I want to define styles for hover,
active, and focus states on any element directly in the WYSIWYG panel so I can
design interactive behaviour visually without writing CSS pseudo-class selectors
manually.

**Behaviour**

- A state switcher appears at the top of the properties panel when any element
  is selected:
  ```
  [ Default ]  [ Hover ]  [ Active ]  [ Focus ]
  ```
- Switching to a state mode changes the panel to show styles for that state
- Edits made in a non-default state write to a pseudo-class block in the CSS
  module:
  ```css
  .rect_a1b2 {
    background: #ffffff;
    border-radius: 8px;
  }

  .rect_a1b2:hover {
    background: #f0f0f0;
    transform: translateY(-2px);
  }

  .rect_a1b2:active {
    background: #e0e0e0;
    transform: translateY(0);
  }
  ```
- The panel in a non-default state shows:
  - Properties with overrides for that state shown with a highlighted indicator
  - Properties inherited from the default state shown at reduced opacity with
    a "same as default" label
  - Only changed properties are written to the pseudo-class block — no
    redundant declarations
- A small dot indicator on the state switcher button signals that a state has
  overrides defined (e.g. the Hover button shows a dot if hover styles exist)
- Removing all overrides from a state removes the pseudo-class block from the
  CSS file entirely

**Canvas preview of states**

- Hovering over an element on the canvas in Select mode shows the hover state
  styles applied temporarily — this is a canvas preview only, not a real browser
  hover event
- The state switcher also has a "preview" toggle per state that locks the canvas
  into showing that state persistently while the user edits

**Code output**

- Pseudo-class blocks are written directly after the base class block in the CSS
  module, grouped by element:
  ```css
  .rect_a1b2 { ... }
  .rect_a1b2:hover { ... }
  .rect_a1b2:active { ... }
  .rect_c3d4 { ... }
  .rect_c3d4:hover { ... }
  ```

**`parseCode` updates**

- The CSS parser must recognise pseudo-class selectors (`:hover`, `:active`,
  `:focus`) and map them back to the correct element's state overrides in
  Zustand state
- Unrecognised pseudo-classes (`:focus-visible`, `:checked`, `:disabled` etc.)
  should be preserved in `customProperties` verbatim and shown in the raw CSS
  editor

**Notes**

- Focus-visible is the accessibility-correct version of `:focus` for keyboard
  navigation — worth adding as a fourth state option in a follow-up
- States interact with transitions (story 1) — a transition on the default state
  applies to all state changes automatically, which is the correct CSS behaviour

---

## 4. CSS animations (preset keyframes)

**User story**

As a user designing animated interfaces, I want to apply a CSS animation to any
element by choosing from a preset library of named keyframe animations and
setting the animation properties, so I can add motion to my designs without
writing `@keyframes` by hand.

**Behaviour**

**Applying an animation**

- An "Animation" section appears in the WYSIWYG panel for every selected element
- A searchable dropdown lists all available preset animations grouped by
  category (see preset library below)
- Selecting a preset populates the animation property controls and writes the
  `animation` shorthand to the element's CSS class
- The `@keyframes` block for the selected preset is automatically appended to
  the bottom of the CSS module if it isn't already there — one copy per file
  regardless of how many elements use it

**Animation property controls**

| Control | Type | Default |
|---|---|---|
| Duration | Number input + unit toggle (ms / s) | 300ms |
| Easing | Dropdown: ease, linear, ease-in, ease-out, ease-in-out | ease |
| Delay | Number input + unit toggle (ms / s) | 0ms |
| Iteration | Number input or ∞ toggle | 1 |
| Direction | Dropdown: normal, reverse, alternate, alternate-reverse | normal |
| Fill mode | Dropdown: none, forwards, backwards, both | forwards |
| Play state | Toggle: running / paused | running |

**Preset animation library**

*Entrances*
- `fade-in` — opacity 0 → 1
- `fade-in-up` — opacity 0 + translateY(16px) → opacity 1 + translateY(0)
- `fade-in-down` — opacity 0 + translateY(-16px) → opacity 1 + translateY(0)
- `slide-in-left` — translateX(-100%) → translateX(0)
- `slide-in-right` — translateX(100%) → translateX(0)
- `scale-in` — scale(0.95) + opacity 0 → scale(1) + opacity 1
- `bounce-in` — scale overshoot on entry

*Exits*
- `fade-out` — opacity 1 → 0
- `fade-out-up` — opacity 1 + translateY(0) → opacity 0 + translateY(-16px)
- `slide-out-left` — translateX(0) → translateX(-100%)
- `slide-out-right` — translateX(0) → translateX(100%)
- `scale-out` — scale(1) + opacity 1 → scale(0.95) + opacity 0

*Attention*
- `pulse` — scale 1 → 1.05 → 1, loops
- `shake` — rapid translateX oscillation
- `bounce` — translateY loop with easing
- `spin` — rotate 0 → 360deg, loops
- `ping` — scale + opacity pulse for notification dots

*Subtle*
- `float` — gentle translateY oscillation, loops
- `wiggle` — subtle rotate oscillation

**Canvas preview**

- A play button in the Animation section triggers the animation once in the
  canvas so the user can preview it without switching to preview mode
- Animations do not loop in the canvas by default during editing — too distracting

**Code output**

```css
.rect_a1b2 {
  animation: fade-in-up 300ms ease forwards;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**`parseCode` updates**

- The parser must handle `@keyframes` blocks — recognised preset names are
  mapped back to the animation picker, unrecognised keyframe names are preserved
  verbatim
- The `animation` shorthand is one of the most complex CSS shorthands to parse
  — handle it carefully, test thoroughly

**Notes**

- Custom keyframes are out of scope for this story — the preset library covers
  the vast majority of use cases and avoids the complexity of a keyframe editor
- Agents can write custom `@keyframes` blocks directly and they will be preserved
  verbatim through the `customProperties` passthrough — so power users aren't
  blocked from custom animations, they just can't create them in the UI yet
- `prefers-reduced-motion` support: consider writing animations inside a
  `@media (prefers-reduced-motion: no-preference)` block so the output is
  accessible by default

---

## 5. Preview mode

**User story**

As a user designing a layout, I want to open my current project in a preview
window that runs real React so I can test interactions, hover states, transitions,
animations, links, and eventually data-driven content in a true browser
environment outside of the canvas.

**Rendering approach**

The preview runs a local **Vite dev server** spawned by the Electron main process
pointing at the project folder. The preview `BrowserWindow` loads
`localhost:[PORT]` — real React, real CSS Modules, real HMR. This is not a
simulation or a TSX-to-HTML conversion.

This approach is chosen over static HTML rendering because:
- Interactions, transitions, animations, and focus states all work exactly as
  they would in a real browser
- React expressions like `{user.name}` render correctly with mock data (see
  data feature notes below)
- Links between pages (story 6) work via React Router without any special
  handling
- HMR means file changes appear in the preview in milliseconds without a
  full reload
- The project folder becomes a fully standalone runnable React app — users
  can `npm run dev` from the terminal and get the same preview outside Scamp

**Project folder scaffolding**

When a new project is created, Scamp auto-generates the minimal files needed
for the Vite server alongside the design files. The user never needs to touch
these:

```
my-project/
├── agent.md
├── package.json           ← auto-generated, lists react + vite + react-router
├── vite.config.ts         ← auto-generated, minimal config
├── index.html             ← auto-generated, React root entry point
├── main.tsx               ← auto-generated, mounts app with router
├── home.tsx               ← design files (user's work)
├── home.module.css
├── dashboard.tsx
└── dashboard.module.css
```

`package.json` and `vite.config.ts` are documented in `agent.md` as
infrastructure files — agents should not modify them.

**Behaviour**

- "Preview" button in the toolbar opens a new `BrowserWindow` (keyboard: `Cmd+P`)
- On first open, the main process checks if `node_modules` exists in the project
  folder — if not, runs `npm install` automatically with a progress indicator
  in the preview window before starting the server
- The Vite server starts on a random available port and the preview window
  navigates to `localhost:[PORT]/[current-page]`
- The preview window has its own toolbar:
  ```
  [ ← ]  [ → ]  [ ↺ ]  [  URL bar (read-only, shows current page)  ]  [ 390 ▾ ]
  ```
  - Back / forward navigate through page history
  - Refresh restarts the Vite server if needed
  - Viewport width selector: Mobile (390) / Tablet (768) / Desktop (1440) /
    Custom — resizes the window to simulate different screen sizes
- HMR handles file changes automatically — the chokidar watcher in the main
  process no longer needs to trigger preview reloads, Vite handles it
- The Vite server is stopped when the preview window is closed or the project
  is closed
- Only one Vite server runs per project at a time — opening the preview window
  again reuses the running server

**Mock data for preview (foundation for future data feature)**

Each page can have an optional `[page-name].data.json` file alongside it:

```
home.tsx
home.module.css
home.data.json        ← optional mock data for preview
```

If a `home.data.json` exists, the auto-generated `main.tsx` injects it as
props or context when rendering the `Home` component in preview mode. This
allows expressions like `{user.name}` in the TSX to resolve to real values
in the preview. The canvas shows a placeholder for dynamic expressions —
the preview shows the real rendered output.

This convention establishes the pattern for the full data binding feature
without requiring any data binding UI to be built yet.

**Notes**

- The preview window should remember its size and position between sessions
- If the TSX file has a syntax error, Vite's error overlay handles it —
  the preview window shows the error clearly with file and line number
- Opening preview on a page with no content shows a helpful empty state
- The `npm install` step on first open only runs once per project — subsequent
  opens reuse the existing `node_modules`
- Preview mode is where transitions, animations, and hover states become fully
  testable — this makes it a key dependency for validating stories 1, 3, and 4
- The standalone runnable project is a meaningful part of Scamp's value
  proposition and worth calling out in the marketing: users own a real,
  runnable React project, not just design files

---

## 6. Linking between pages

**User story**

As a user designing a multi-page project, I want to link any element to another
page in my project so I can navigate between pages in preview mode and create a
clickable prototype that demonstrates the full flow.

**Behaviour**

- Any element can have a link assigned to it via the Element section of the
  WYSIWYG panel
- A "Link to" dropdown lists all pages in the current project plus an
  "External URL" option:
  ```
  Link to:  [ home  ▾ ]   [ Open in new tab ☐ ]
  ```
- Selecting a page sets the element's `href` in the TSX output — if the
  element is not already an `<a>` tag, Scamp wraps its content in one:
  ```tsx
  <div data-scamp-id="a1b2" className={styles.rect_a1b2}>
    <a href="./dashboard" className={styles.link_a1b2}>
      {children}
    </a>
  </div>
  ```
- The generated `href` uses a relative path that matches the page file name
  (`./dashboard` links to `dashboard.tsx`)
- In the canvas, linked elements show a small link indicator icon in the
  top-right corner of the element — clicking it in Select mode navigates
  the canvas to the linked page
- External URL option allows a free-text URL input — opens in a new tab in
  preview mode
- Removing a link clears the `href` and removes the wrapping `<a>` tag if
  one was added automatically

**Preview mode integration**

- Links between pages work in preview mode (story 5) — clicking a linked
  element navigates the preview window to the linked page
- The preview window's back/forward buttons allow navigation through the
  link history
- The URL bar in the preview window updates to show the current page name

**Notes**

- Wrapping an element in an `<a>` tag automatically is a meaningful change to
  the TSX structure — the `element:rename` IPC pattern should be followed here,
  writing both files atomically
- If the linked page is deleted, the link should be flagged with a warning
  indicator in the canvas — "Linked page not found" — rather than silently
  leaving a broken href
- External links in preview mode open in the system browser, not in the
  preview window, since the preview is scoped to the project

---

## Retire the legacy project format

**User story**

As a Scamp maintainer, I want to delete the legacy (flat) project format
once most active projects have migrated to the Next.js App Router layout,
so the codebase has a single canonical project shape and the
`*Legacy` namespacing can come out.

**When to do this**

- Telemetry / vibes suggest the majority of active projects are on the
  nextjs format.
- The Next.js App Router layout has been stable for at least one release.
- Preview mode (separate backlog item) is shipping for nextjs projects;
  legacy users have a clear reason to migrate.

**Scope**

- Delete `AGENT_MD_CONTENT_LEGACY` from `src/shared/agentMd.ts`.
- Delete `generateCodeLegacy` (and the `cssModuleImportName` parameter
  it threads through `generateCode`) from `src/renderer/lib/generateCode.ts`.
- Delete `scaffoldLegacyProject`, `readProjectLegacy`, `themePathFor`'s
  legacy branch from `src/main/ipc/projectScaffold.ts`.
- Delete legacy branches from `src/main/ipc/pageOps.ts`,
  `src/main/ipc/pageRename.ts`, `src/main/ipc/imageOps.ts`,
  `src/main/ipc/theme.ts`.
- Delete the migration banner / `project:migrate` IPC and the
  `projectMigrate.ts` core. (At this point legacy users can no longer
  open their projects in Scamp; they need to migrate via an older
  release first.)
- Drop the `format` field from `ProjectData` and `RecentProject`.
- Drop the `projectFormatCache` (only one format means no dispatch).

**Risks**

- A small minority of users may still be on legacy when we cut. We
  should ship at least one release that warns "legacy support will be
  removed in version X" before pulling the trigger.
- Some legacy projects may have unrecognised root-level files that the
  migrator left in place — those still apply after deletion, but the
  user's project won't open without a manual reorganisation.