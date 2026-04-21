# Canvas Size Rework — Plan

**Status:** Draft for review.
**Date:** 2026-04-21
**Story:** `docs/backlog-2.md` §5.

## Goal

Stop baking the canvas size into the generated CSS. The root element
becomes a regular rectangle with `width: 100%; height: auto` defaults.
The canvas viewport frame gets its own width (and optional
overflow-hidden toggle) that lives in per-project metadata, never in
the CSS file. Page height grows with content — the canvas scrolls.

---

## What changes

### 1. Root is a regular rectangle (no sizing special-cases)

- **`generateCode.ts`** currently has a root-specific branch
  (`elementDeclarationLines` for `isRoot`) that always emits `width`,
  `min-height`, `position: relative`. Delete that branch — the root
  flows through the same code path as any other rectangle.
- **`parseCode.ts`** currently uses `makeRoot()` and a `min-height → height`
  rewrite for the root. Same — root uses `makeBaseline` like everything
  else; `min-height` rewrite goes away.
- **`DEFAULT_ROOT_STYLES`** in `defaults.ts` becomes:
  ```ts
  widthMode: 'stretch',   // 100%
  widthValue: 1440,       // fallback when user switches mode
  heightMode: 'auto',
  heightValue: 900,
  // (the rest unchanged — backgroundColor, flex defaults, etc.)
  ```
- **`DEFAULT_PAGE_CSS`** in `agentMd.ts` — drop the fixed width /
  min-height / position lines. Default `.root {}` is empty; the
  generator's omit-if-default keeps it text-stable.
- **Open question (small):** does the exported TSX's root still need
  `position: relative` to keep absolute-positioned children anchored to
  the page? Today absolute children of root rely on root having
  `position: relative`. If we drop it, children anchor to `<body>` in
  the exported app, which may or may not match the user's intent.
  **Recommendation:** keep `position: relative` as a default on the
  root (unlike a regular rect where it's omitted). This is the one
  justified exception to "root is a regular rectangle" — it preserves
  correctness of existing designs with absolute children.

### 2. Viewport frame owns its own size

- **`src/renderer/src/canvas/Viewport.tsx`** currently reads
  `frameW = rootElement.widthValue` and `frameMinH = rootElement.heightValue`.
  Replace with two new props fed from `scamp.config.json`:
  ```ts
  canvasWidth: number;        // default 1440
  canvasOverflowHidden: boolean;  // default false
  ```
- The frame's `width` uses `canvasWidth`. No `min-height` —
  content size alone drives height. Preserve the ResizeObserver that
  tracks `frame.offsetHeight` for the scaled-wrapper math.
- The frame's inline `overflow` flips on `canvasOverflowHidden`.
- `ProjectShell` already loads `scamp.config.json` via
  `window.scamp.readProjectConfig`; it just grows two more fields.

### 3. Canvas size control in the toolbar

- Add a new `CanvasSizeControl` component in `src/renderer/src/components/`.
- Lives in `Toolbar.tsx` next to `ZoomControls` (both are "workspace"
  controls, not "element" controls). Matches existing popover/dropdown
  precedent.
- Renders as a button labeled with the current width (`1440px`) that
  opens a popover with:
  - Preset buttons: Mobile 390 · Tablet 768 · Desktop 1440 · Wide 1920
  - A custom-width number input
  - An "Overflow hidden" checkbox
- On change, writes `scamp.config.json` via the existing
  `writeProjectConfig` IPC. The Viewport re-renders with the new size.

### 4. Canvas panel handles vertical scroll

Already mostly in place — `Viewport.module.css` has `.container {
overflow: auto }` and the `frameShell` reserves scaled height. Changes:

- Remove the `frameMinH` fallback (height is content-driven now).
- Verify the frame still lays out correctly when its content height
  exceeds the viewport by a large margin — the sizing shell already
  reserves `frameH * scale`.
- The auto-fit-to-width logic (L57–77) is width-only and doesn't care
  about frame height. Keep as-is.

### 5. Per-project metadata — extend `scamp.config.json`

The story says "app metadata alongside recent projects in
`app.getPath('userData')`", but I recommend putting it in
`scamp.config.json` instead. **Decision for review.**

**Pros of `scamp.config.json`** (recommended):
- Infrastructure already exists (`src/shared/projectConfig.ts`,
  `src/main/ipc/projectConfig.ts`, `ensureProjectConfig` on open).
- Travels with the project folder when the user copies or shares it —
  canvas size is a design-tool choice, but it's a per-project one.
- `artboardBackground` set a pattern; canvas size fits it naturally.

**Pros of userData (per story wording):**
- Canvas size is strictly a design-tool-UI concern — doesn't belong
  next to the project files if someone commits them to git.
- Clearer separation: "what the file looks like" (project) vs "how I
  view it" (user preference).

**If we go with `scamp.config.json`:** extend `ProjectConfig` +
`DEFAULT_PROJECT_CONFIG` in `src/shared/types.ts` with the two fields,
extend the parser in `src/shared/projectConfig.ts` with clamping
(`canvasWidth: max(100, min(4000, n))`) and a boolean check. Old
projects backfill to defaults via `ensureProjectConfig`.

**If we go with userData:** new main-side module
`src/main/projectMetadata.ts`, new IPC channels
`projectMetadata:get`/`set`, JSON file keyed by project path,
migration-aware read. More plumbing; little extra value.

### 6. Migration

Existing projects have `width: 1440px; min-height: 900px; position: relative`
on `.root`. We need to detect and migrate that specific shape to the
new defaults (`width: 100%; height: auto`, plus `position: relative`
kept intact).

**Detection** (in `parseCode.ts`'s root branch, pre-declaration):
detect the exact three-tuple — a `width: <N>px`, a `min-height: <M>px`,
and a `position: relative`, and no other size-related declarations
(no `height`, no `max-width`, etc.). If all three match, drop them
from the declaration list before `applyDeclarations` runs; the new
`DEFAULT_ROOT_STYLES` (stretch/auto) takes over.

**False-positive risk:** a user who deliberately authored exactly
those three declarations on their root CSS would also get migrated.
Acceptable trade-off — the migration only applies to the root class,
the new default behavior is the correct production-grade one, and the
user can re-enter a fixed width from the panel. Worst case is a brief
visual change; no data loss.

**One-time migration notice:** the story asks for a user-facing
banner. Cheapest implementation: use the existing App Log (terminal
panel) since there's no toast system. **Decision for review:**
- A) a small one-line banner component pinned to the top of the
  canvas for the session, dismissible.
- B) just a log entry in the App Log tab.
- C) a proper modal on first open of a migrated project.

I'd go with **(A)** — visible but not blocking, dismissible, and
doesn't require a new modal shell.

**Tracking "already migrated":** we don't need per-project state for
this. The migration is idempotent — once the root's CSS no longer has
the old three-tuple, subsequent opens are no-ops.

### 7. Root UI reshape in the properties panel

- **`UiPanel.tsx`** today routes the root to a special branch that
  renders `RootSizeSection`. Remove the branch; render the regular
  section set for the root (Element section + Size + Layout + Spacing
  + Background + Border + Visibility). Root-specific UX survives only
  via id-based checks where needed (e.g. Position section hidden
  because root has no parent).
- **`RootSizeSection`** in `sections/SizeSection.tsx` deleted.
  `SizeSection` handles root fine once root is a regular rectangle.

### 8. Canvas interactions that read root dimensions

- **`CanvasInteractionLayer.parentSizeOf`** reads
  `el.widthValue`/`el.heightValue` to clamp draws/drags to parent
  bounds. With root in `stretch`/`auto` those numbers are meaningless.
  Fix: for the root specifically, use `canvasWidth` from project
  config for the width axis and `Number.POSITIVE_INFINITY` for the
  height axis (the page grows with content, so drawing deep below the
  fold should be allowed).
- **`canvasSlice.duplicateElement`** does the same clamp — same fix.
- **`ElementRenderer`** has a root branch at L131–168 (`minHeight:
  isRoot ? heightStyle : undefined`; `position: isRoot ? 'relative' : ...`).
  Drop the `minHeight` (frame owns the height now). Keep
  `position: 'relative'` on the rendered root so absolute children
  behave consistently both on the canvas and in the exported TSX.

### 9. `agent.md`

Today's `agent.md` (in `src/shared/agentMd.ts`) documents old root
rules:
- "The page root uses `min-height` (NOT `height`)…"
- "Do not strip the `min-height` / `width` / `position` lines from `.root`…"

Replace with a note that the root is a regular rectangle; the
viewport size is a scamp UI concept and isn't written to CSS. Keep
the `position: relative` default note so agents don't strip it.

---

## Tests to update

Mechanical updates, meaningful volume:

- `test/integration/sync.integration.test.ts` — every `makeRoot`
  factory (≥7 tests) uses `widthMode: 'fixed', widthValue: 1440,
  heightMode: 'fixed', heightValue: 900`. Switch to the new defaults.
- `test/generateCode.test.ts` — same `makeRoot`. Also update the
  "emits width/min-height/position" root assertions.
- `test/parseCode.test.ts` — the root-parse tests that assume
  `heightValue: 900` from `min-height` need rewriting.
- `test/defaults.test.ts` — `DEFAULT_ROOT_STYLES` assertions.
- New tests:
  - `test/rootMigration.test.ts` — old-format root CSS → parseCode →
    expected new shape.
  - Round-trip: root with user-customised fixed width survives clean
    through generateCode → parseCode.

Recommended: **land the "new root defaults" rewiring first (generator
+ parser + tests) as a single commit**, before touching the Viewport
or adding controls. Keeps each commit small.

---

## Phased rollout

### Phase 1 — Root-as-rectangle (data layer)

1. Update `DEFAULT_ROOT_STYLES` (stretch/auto + keep the rest).
2. Strip the root branch from `generateCode.elementDeclarationLines`.
3. Strip the root branch from `parseCode` (root uses `makeBaseline`).
4. Always emit `position: relative` on root (one-line special case in
   the generator; mirrored in the parser to not round-trip as a
   custom property).
5. Update `DEFAULT_PAGE_CSS`.
6. Update tests — factories, assertions, migration test.

### Phase 2 — Viewport & canvas-size control

1. Extend `ProjectConfig` schema (`canvasWidth`, `canvasOverflowHidden`).
2. Thread the config through `ProjectShell` → `Viewport` props.
3. `Viewport.tsx` reads canvas size from props, not from root element.
4. Add `CanvasSizeControl` popover to the toolbar.
5. Delete `RootSizeSection` from `SizeSection.tsx`; drop the UiPanel
   root branch so the regular section set renders for root.
6. Fix `CanvasInteractionLayer.parentSizeOf` + `duplicateElement`
   clamps to use canvas width for root.
7. Drop `minHeight` from `ElementRenderer`'s root branch.

### Phase 3 — Migration

1. Add root-declaration three-tuple detector in `parseCode.ts`.
2. Track migration-triggered state (a flag returned in `ParsedTree`),
   bubble up to the UI.
3. Add a dismissible banner component; show once per session per
   migrated project.
4. Update `agent.md`.

---

## File-by-file changes

| File | Phase | What changes |
|---|---|---|
| `src/renderer/lib/defaults.ts` | 1 | `DEFAULT_ROOT_STYLES` → stretch/auto |
| `src/renderer/lib/generateCode.ts` | 1 | Remove root branch; always emit `position: relative` for root |
| `src/renderer/lib/parseCode.ts` | 1, 3 | Root uses `makeBaseline`; three-tuple migration detector; emit `migrated: true` flag |
| `src/shared/agentMd.ts` | 1 | `DEFAULT_PAGE_CSS` minus the three lines; rewrite the `## What NOT to change` root paragraph |
| `test/**` | 1 | Factories, assertions, new migration test |
| `src/shared/types.ts` | 2 | `ProjectConfig` gets `canvasWidth`, `canvasOverflowHidden` |
| `src/shared/projectConfig.ts` | 2 | Parse / clamp new fields |
| `src/renderer/src/canvas/Viewport.tsx` | 2 | Size from props, not from root element; overflow toggle |
| `src/renderer/src/components/CanvasSizeControl.tsx` (new) | 2 | Popover with presets + custom width + overflow toggle |
| `src/renderer/src/components/Toolbar.tsx` | 2 | Mount `CanvasSizeControl` |
| `src/renderer/src/components/UiPanel.tsx` | 2 | Drop root special branch; render regular section set for root |
| `src/renderer/src/components/sections/SizeSection.tsx` | 2 | Remove `RootSizeSection` export |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | 2 | `parentSizeOf` uses canvas width for root |
| `src/renderer/store/canvasSlice.ts` | 2 | `duplicateElement` clamp for root |
| `src/renderer/src/canvas/ElementRenderer.tsx` | 2 | Drop `minHeight` on root; keep `position: relative` |
| `src/renderer/src/components/MigrationBanner.tsx` (new) | 3 | Dismissible banner above the canvas |
| `src/renderer/src/components/ProjectShell.tsx` | 3 | Show banner when `parsed.migrated === true` |

---

## Decisions for review

1. **Storage location** — recommend `scamp.config.json` (contradicts
   the story wording but fits existing infrastructure). User can
   overrule.
2. **Root `position: relative`** — keep it on the exported root as an
   always-emit default? Recommended yes (preserves existing absolute
   positioning).
3. **Migration notice UX** — dismissible banner above canvas (A),
   App Log entry only (B), or proper modal (C)? Recommend A.
4. **One-time vs every-open banner** — banner dismisses for the
   session, or persists until explicitly acknowledged? Recommend
   session-scoped (simple, no new state).

---

## Risks

1. **Child elements using `widthMode: 'stretch'` inside root** —
   `100%` resolves against the new root width (100% of frame / body)
   instead of 1440. Functionally correct for production; cosmetically
   the child may grow/shrink as the user flips presets. This is the
   *intended* new behavior but worth calling out in a release note.
2. **`CanvasInteractionLayer.parentSizeOf`** using stale
   `widthValue`/`heightValue` for root — fixed in phase 2 but easy to
   miss. Add an integration test that draws a rect near the bottom of
   a tall page to catch regressions.
3. **Migration false-positive** — user who hand-authored the exact
   three-tuple on their root. Mitigation: the new behavior is
   production-correct, and they can re-set fixed width from the
   panel. Document in the migration banner copy.
4. **Toolbar crowding** — the toolbar already has Select/Rectangle/
   Text/Image/Input tool buttons, ZoomControls, save indicator, panel
   toggles, project name. Adding canvas-size may need a small
   layout pass.
5. **Breaking change for agents** — `agent.md` changes mid-project.
   Existing projects will still have the old `agent.md` until the user
   refreshes. Low impact (agent rules get looser, not stricter), but
   worth noting.

---

## Out of scope

- Multiple canvas sizes open side-by-side (designing mobile + desktop
  simultaneously) — that's story #6's territory.
- Exported `<meta viewport>` tag management — Scamp doesn't emit HTML
  scaffolding, only TSX components.
- Persisting user zoom per canvas-size preset.
- Orientation toggle (landscape/portrait) for mobile/tablet presets.
- Auto-fit-to-height zoom mode (currently fit-to-width only).
