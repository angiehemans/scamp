# Playwright UI Tests — Setup & Coverage Plan

**Status:** Draft for review. Do not implement until approved.
**Date:** 2026-04-23
**Scope:** Introduce Playwright as the end-to-end UI test harness against the real Electron app, and enumerate the test suites needed to cover every user-facing feature documented in `docs/user_docs/`.

---

## Goal

Today we have strong unit coverage of `src/renderer/lib/` (pure functions) and three integration tests that exercise the parser/generator round-trip through the real filesystem. What we do **not** have is any test that drives the actual UI: no test launches the Electron app, clicks a button, drags on the canvas, or asserts that the properties panel updates when an element is selected.

The POC is now far enough along that the UI surface is stable — `CLAUDE.md` flagged Playwright as "post-POC" and that moment has arrived. We want a harness that:

1. Launches the real Electron app (main + preload + renderer) against a controlled temp project on disk.
2. Drives real user flows — keyboard, mouse, drag, type.
3. Asserts both visible UI state AND the generated files on disk (the two things a user actually sees).
4. Covers every feature in `docs/user_docs/` so the docs and the behavior stay honest.

Non-goals:

- **Not replacing** unit or integration tests in `test/`. The pure-function layer continues to be tested there; Playwright is only for things that need the UI in the loop.
- **Not visual regression testing** in this plan. Pixel diffs are a separate conversation — we can add `toHaveScreenshot` later if we want them, but the first pass is behavior-only.
- **Not cross-platform CI** in this plan. Local Linux + macOS runs first. Windows and GitHub Actions are a follow-up.

---

## Current state

- `package.json` has Vitest but no Playwright.
- No `playwright.config.ts`, no `test/e2e/` directory.
- **Zero `data-testid` / `data-test` attributes exist anywhere in `src/renderer/src/`.** Every selector will need to be added as we write tests, or we'll rely on role/text queries.
- Electron main builds to `out/main/index.js`; renderer builds to `out/renderer/`. `electron-vite build` produces both.
- The app opens to the **Start Screen** when no project has been loaded. Project loading goes through `src/main/ipc/project.ts` and `src/main/ipc/recentProjects.ts`.
- All disk I/O is mediated by IPC — there is no direct renderer filesystem access — which is ideal for tests: a temp project dir on disk is the single source of truth.
- The app has a `chokidar` file watcher (`src/main/watcher.ts`) that picks up external edits. This is the mechanism we'll use for "external edit" tests.

---

## Harness design

### 1. Playwright + Electron

Playwright has built-in Electron support via `_electron.launch()`. We'll use the stable API (not experimental) and target the already-built `out/main/index.js`.

```ts
// test/e2e/fixtures/app.ts (sketch)
import { _electron as electron, test as base, expect } from '@playwright/test';

export const test = base.extend<{ app, window, projectDir }>({ ... });
```

Add scripts:

```
"test:e2e": "npm run build && playwright test",
"test:e2e:ui": "npm run build && playwright test --ui",
"test:e2e:headed": "npm run build && playwright test --headed",
```

Build before the run is non-negotiable — Playwright drives the **built** Electron app, not `electron-vite dev`. Tests are slow enough that we should not run them in the normal `npm run test` path; they get their own script.

### 2. Project isolation via temp dirs

Every test spins up its own project directory in `os.tmpdir()` and points the app at it. Two approaches, picking one:

**Option A (preferred): Env var override.** Teach `src/main/index.ts` to honour `SCAMP_TEST_PROJECTS_DIR` and `SCAMP_TEST_OPEN_PROJECT` on startup. When set, the app (a) uses the given dir as its "default projects folder" and (b) auto-opens the named project. This means the test can pre-seed disk state, launch the app, and find itself already inside a project — no click-through-the-start-screen boilerplate.

**Option B: Drive the Start Screen.** Every test clicks New Project → types a name → waits for the project to open. Slower, more flaky, but requires zero production-code changes.

Recommending A with a thin guard: the env vars are only read when `process.env.NODE_ENV === 'test'` or a dedicated `SCAMP_E2E=1` flag is set. Start-screen flow still gets its own test suite (it's one of the documented features we must cover).

### 3. Test-only selectors

No `data-testid` attributes exist today. We have two choices:

- **Lean on role/text/placeholder queries.** Works for buttons and inputs. Fails for the canvas (it's a pile of divs with `data-scamp-id`), for toolbar icons (icon-only buttons), and for selection overlays.
- **Add `data-testid` where role queries fall short.** About 30–50 targeted attributes across the codebase: toolbar tool buttons, properties-panel sections, canvas-size popover triggers, breakpoint buttons, save-status indicator, layers-panel rows.

Recommending a hybrid: role/text first, `data-testid` only where role queries are ambiguous or impossible. The existing `data-scamp-id` attribute on canvas elements is **already the perfect hook** for asserting on drawn elements — we should reuse it instead of duplicating.

A test-support helper module (`test/e2e/fixtures/selectors.ts`) will centralize all the queries so renaming a testid only touches one file.

### 4. File-system assertions

Tests must assert on both UI state AND generated code. A helper:

```ts
async function readPageFiles(projectDir, pageName) {
  const tsx = await fs.readFile(path.join(projectDir, `${pageName}.tsx`), 'utf-8');
  const css = await fs.readFile(path.join(projectDir, `${pageName}.module.css`), 'utf-8');
  return { tsx, css };
}
```

Because writes are debounced (~200ms), tests need to `await` the save-status indicator hitting "Saved" before reading disk. We already render that indicator; we just need a stable selector on it.

### 5. External-edit simulation

For bidirectional-sync tests, we write to disk directly via `fs.writeFile` and wait for the canvas to reflect the change. Chokidar fires within ~100ms locally. The `waitFor` condition is a DOM assertion (e.g. the element's inline style changed), not a timer.

### 6. Build artifacts

- Playwright config writes screenshots + video for failed tests to `test-results/`.
- Add `test-results/` and `playwright-report/` to `.gitignore`.
- Traces on first retry only.

---

## Directory layout

```
test/
  e2e/
    fixtures/
      app.ts               # Electron launch fixture
      project.ts           # temp project dir fixture
      selectors.ts         # centralized selector helpers
      assertions.ts        # readPageFiles, waitForSaved, etc.
    getting-started.spec.ts
    canvas/
      draw-rect.spec.ts
      draw-text.spec.ts
      draw-image.spec.ts
      draw-input.spec.ts
      select-move-resize.spec.ts
      nudge.spec.ts
      zoom.spec.ts
      canvas-size.spec.ts
    elements/
      tag-change.spec.ts
      tag-attributes.spec.ts
      select-options.spec.ts
      svg-source.spec.ts
      list-context-defaults.spec.ts
    properties-panel/
      visual-mode.spec.ts
      css-mode.spec.ts
      size-controls.spec.ts
      layout-flex.spec.ts
      spacing-shorthand.spec.ts
      background.spec.ts
      border.spec.ts
      visibility-opacity.spec.ts
      override-dot.spec.ts
    breakpoints/
      switch-breakpoint.spec.ts
      override-routing.spec.ts
      css-output.spec.ts
      custom-breakpoint.spec.ts
    typography/
      text-creation.spec.ts
      font-picker.spec.ts
      alignment-spacing.spec.ts
    color-picker/
      hex-input.spec.ts
      alpha-output.spec.ts
      tokens-tab.spec.ts
      project-swatches.spec.ts
    element-naming/
      rename.spec.ts
      clear-name.spec.ts
    grouping/
      group-ungroup.spec.ts
      nested-groups.spec.ts
    layers-panel/
      selection.spec.ts
      reorder-dnd.spec.ts
      tooltips.spec.ts
    code-output/
      live-preview.spec.ts
      save-status.spec.ts
    bidirectional-sync/
      external-css-edit.spec.ts
      external-tsx-edit.spec.ts
      watcher-clears-undo.spec.ts
    themes/
      theme-panel-crud.spec.ts
      tokens-in-picker.spec.ts
      theme-css-autocomplete.spec.ts
    terminal/
      toggle-panel.spec.ts
      multiple-tabs.spec.ts
      persistence.spec.ts
    settings/
      app-settings.spec.ts
      project-settings-breakpoints.spec.ts
      project-settings-artboard.spec.ts
      project-settings-fonts.spec.ts
    undo-redo/
      basic-undo-redo.spec.ts
      history-limit.spec.ts
      clears-on-external-edit.spec.ts
      clears-on-page-switch.spec.ts
    keyboard-shortcuts/
      tool-shortcuts.spec.ts
      action-shortcuts.spec.ts
      zoom-shortcuts.spec.ts
playwright.config.ts
```

---

## Feature-by-feature coverage

Below, every file in `docs/user_docs/` is mapped to the specs that will cover it. Each spec lists the concrete user flows we'll automate. If something is listed in the docs but isn't going to be covered, that's called out explicitly.

### getting-started.md → `getting-started.spec.ts`

- Start screen renders with sidebar + recent projects.
- "New Project" flow: click button, type name, project opens with blank canvas and a single "home" page.
- After creation, the project folder on disk contains `home.tsx`, `home.module.css`, `theme.css`, `agent.md`.
- Recent projects list updates after a project is opened.
- Not covered: installer behavior (out of scope — we can't test the installer from inside Electron).

### canvas.md → `canvas/*.spec.ts`

- **draw-rect**: R activates rectangle tool; drag on canvas draws a rect; rect appears in layers panel; TSX + CSS on disk contain `rect_…`.
- **draw-text**: T activates text tool; click places a text element; default tag is `<p>`.
- **draw-image**: I activates image tool; stub `dialog.showOpenDialog` to return a fixture image path; image element appears.
- **draw-input**: F activates input tool; drag places an `<input>`.
- **select-move-resize**: V selects; click selects; drag moves; handle-drag resizes; empty-canvas click deselects; clicking page-name badge selects page root.
- **nudge**: Arrow keys move by 1px; Shift+Arrow by 10px. Clamp to visible page.
- **zoom**: Cmd+= / Cmd+- / Cmd+0 change zoom; zoom indicator reflects level.
- **canvas-size**: breakpoint preset buttons resize canvas + switch active breakpoint; custom width input between 100–4000 works; custom width drops breakpoint to Desktop; overflow hidden toggle; canvas width persists to `scamp.config.json`.

### elements.md → `elements/*.spec.ts`

- **tag-change**: Change rect to `<nav>`, text to `<h1>`; class prefix unchanged; TSX reflects new tag.
- **tag-attributes**: For each of `a`, `button`, `form`, `label`, `blockquote`, `time`, `dialog`, `video`, `iframe`, `input`, `textarea`, attribute fields appear and round-trip to TSX. Boolean attributes (`controls`, `autoplay`, `muted`, `loop`, `open`) emit without a value.
- **select-options**: Add/remove/rename options in a `<select>`; mark one as initially selected; TSX emits `<option>` children with `selected`.
- **svg-source**: Raw SVG in textarea renders as placeholder rect on canvas but appears byte-for-byte in TSX.
- **list-context-defaults**: Drawing a rect inside a `<ul>` defaults to `<li>`; same for text.

### properties-panel.md → `properties-panel/*.spec.ts`

- **visual-mode**: Only relevant sections appear (text has no Layout; image has no Background Color).
- **css-mode**: Toggle to CSS editor; type raw CSS; commit on blur and on Cmd+S; unknown properties round-trip.
- **size-controls**: W/H numeric inputs; each has Fixed/Stretch/Hug/Auto mode selector; generated CSS reflects mode.
- **layout-flex**: Block/Flex toggle; for flex, direction/align/justify/gap controls emit correct CSS.
- **spacing-shorthand**: Type `10`, `10 20`, `10 20 30 40` in padding/margin — each shorthand parses to correct per-side values. (This is unit-tested in `parsers.test.ts`; the UI test verifies the input field wires to the parser correctly.)
- **background**: Color swatch opens picker; background image set via file picker (stub dialog); size/position/repeat controls emit correct CSS.
- **border**: Color/style/width/radius controls; radius shorthand `10 20 10 20`.
- **visibility-opacity**: Opacity 0–100; Visible/Hidden/None segmented control emits visibility+display correctly.
- **override-dot**: At a non-desktop breakpoint, sections with overrides show a blue dot; hover shows tooltip listing overridden properties; right-click resets them.

### breakpoints.md → `breakpoints/*.spec.ts`

- **switch-breakpoint**: Canvas-size control shows active breakpoint; switching resizes canvas + routes edits.
- **override-routing**: Edit padding at Tablet → lands in `@media (max-width: 768px)` block in CSS; base CSS unchanged.
- **css-output**: Cascade CSS — base + widest-first `@media` blocks; unknown `@media` queries round-trip verbatim.
- **custom-breakpoint**: Add a custom breakpoint in Settings; it appears in the canvas-size popover; edits route to its `@media` block.

### typography.md → `typography/*.spec.ts`

- **text-creation**: T tool + drag places text element.
- **font-picker**: Search field filters Google Fonts + system fonts; selecting a Google Font adds a CDN link to the TSX/head. Offline fonts work without CDN.
- **alignment-spacing**: L/C/R align buttons, line-height, letter-spacing inputs emit correct CSS.

### color-picker.md → `color-picker/*.spec.ts`

- **hex-input**: Type `#ff6600`, output is `#ff6600`.
- **alpha-output**: Alpha 1 → `#rrggbb`; alpha < 1 → `rgba(...)`.
- **tokens-tab**: Tokens tab lists tokens from `theme.css`; clicking a token emits `var(--token)` in CSS.
- **project-swatches**: Colors used elsewhere in the project appear as swatches, sorted by frequency.

### element-naming.md → `element-naming/*.spec.ts`

- **rename**: Double-click name in layers panel, type "Hero Card", Enter → class is `hero_card_<shortid>`; title case in panel, snake_case in CSS.
- **clear-name**: Clear field + Enter → reverts to `rect_`/`text_` prefix.

### grouping.md → `grouping/*.spec.ts`

- **group-ungroup**: Select two siblings, Cmd+G → wrapper rect created with `display:flex`, children x/y reset to 0; Cmd+Shift+G → wrapper removed, children promoted.
- **nested-groups**: Group a group inside another group; no page-root grouping; non-sibling grouping is a no-op.

### layers-panel.md → `layers-panel/*.spec.ts`

- **selection**: Click selects; shift-click multi-selects; canvas and panel stay in sync.
- **reorder-dnd**: Drag-drop within panel reorders; drop onto another element re-parents.
- **tooltips**: Hover shows CSS class name.

### code-output.md → `code-output/*.spec.ts`

- **live-preview**: Bottom panel shows generated TSX and CSS; updates on every canvas edit.
- **save-status**: States `Saved`, `Saving…`, `Unsaved`, `Save failed`; Retry button reappears and works when the write fails. (Failure path: make the project dir read-only and trigger a write.)

### bidirectional-sync.md → `bidirectional-sync/*.spec.ts`

- **external-css-edit**: Edit `home.module.css` via `fs.writeFile`; canvas updates within ~500ms.
- **external-tsx-edit**: Edit `home.tsx` externally to add a new element; canvas shows it.
- **watcher-clears-undo**: External edit clears undo stack. (Overlaps with undo-redo suite — owned there.)
- Not covered: `agent.md` content / format (it's a static file, no behavior to test beyond "it was created").

### themes.md → `themes/*.spec.ts`

- **theme-panel-crud**: Open theme panel, add token, rename token, delete token; all changes reflect in `theme.css` on disk.
- **tokens-in-picker**: Tokens tab in color picker lists every token from `theme.css`.
- **theme-css-autocomplete**: In the properties-panel CSS editor, typing `var(--` suggests token names.

### terminal.md → `terminal/*.spec.ts`

- **toggle-panel**: Ctrl+` toggles the panel.
- **multiple-tabs**: Up to 3 tabs; attempting a 4th is refused or disabled.
- **persistence**: Start a long-running command, hide the panel, reopen — output is still there.
- Note: Requires `node-pty` working in the test environment. On CI we may need to skip terminal tests on platforms where `node-pty` can't rebuild.

### settings.md → `settings/*.spec.ts`

- **app-settings**: Change default projects folder; new projects land in the new folder.
- **project-settings-breakpoints**: Edit labels/widths, add/delete breakpoints; Desktop is not deletable; list stays widest-first; `scamp.config.json` reflects changes.
- **project-settings-artboard**: Change artboard background; only canvas chrome changes, generated CSS unaffected.
- **project-settings-fonts**: Manage Google Fonts list for the project.

### undo-redo.md → `undo-redo/*.spec.ts`

- **basic-undo-redo**: Add/resize/rename — Cmd+Z reverts, Cmd+Shift+Z replays. Assert on disk as well as on canvas.
- **history-limit**: 50 steps; 51st push drops the oldest.
- **clears-on-external-edit**: External write empties the undo stack.
- **clears-on-page-switch**: Navigate to another page → previous page's history is cleared.

### keyboard-shortcuts.md → `keyboard-shortcuts/*.spec.ts`

Most shortcuts are covered in their feature spec. The dedicated shortcuts suite is a cross-cutting smoke test:

- **tool-shortcuts**: V/R/T/I/F each activate the right tool. Also verify shortcuts are **disabled** while focused on a text input or the CSS editor.
- **action-shortcuts**: Cmd+D duplicate, Delete/Backspace remove, Cmd+G/Shift+G group/ungroup, Cmd+C/Cmd+V copy/paste, Cmd+Z/Shift+Z undo/redo, Cmd+S save-from-CSS-editor, Arrow/Shift+Arrow nudge.
- **zoom-shortcuts**: Cmd+=/-/0.

---

## Work breakdown

### Phase 1 — Harness (approx. 0.5–1 day)

1. `npm i -D @playwright/test playwright`; `npx playwright install` (Chromium is bundled but not used — we're driving Electron directly).
2. Create `playwright.config.ts`: single `electron` project, 60s timeout, retries=1, reporter=list+html.
3. Add `test:e2e*` scripts.
4. Implement the Electron launch fixture + temp-project fixture in `test/e2e/fixtures/`.
5. Add `SCAMP_E2E=1` guarded env var hooks in `src/main/index.ts` (projects dir override + auto-open).
6. Add the `selectors.ts` helper module — empty at first, grow as each suite lands.
7. Add `test-results/` + `playwright-report/` to `.gitignore`.
8. Write a smoke spec (`getting-started.spec.ts`) proving the harness can launch, open a project, and read/write disk. **Gate all further work on this passing.**

### Phase 2 — Core canvas + code-output (approx. 1–2 days)

Highest-value suites, most likely to catch real regressions:

- `canvas/draw-rect.spec.ts` (+ other draw specs)
- `canvas/select-move-resize.spec.ts`
- `canvas/nudge.spec.ts`
- `code-output/live-preview.spec.ts`
- `code-output/save-status.spec.ts`
- `bidirectional-sync/external-css-edit.spec.ts`

This phase validates the core "draw → generate → parse" loop end-to-end. Anything after this is feature-surface coverage.

### Phase 3 — Properties, elements, typography, color (approx. 2–3 days)

- All of `properties-panel/*`
- All of `elements/*`
- All of `typography/*`
- All of `color-picker/*`

### Phase 4 — Breakpoints + responsive (approx. 1 day)

- All of `breakpoints/*`
- The breakpoint-aware subset of `properties-panel/override-dot.spec.ts`

### Phase 5 — Structural features (approx. 1 day)

- `element-naming/*`
- `grouping/*`
- `layers-panel/*`
- `undo-redo/*`

### Phase 6 — Surrounding features (approx. 1 day)

- `themes/*`
- `terminal/*` (guarded by node-pty availability)
- `settings/*`
- `keyboard-shortcuts/*`

### Phase 7 — CI integration (separate plan)

Not in this plan's scope; noting here so it doesn't get lost.

---

## Risks & open questions

1. **Canvas interactions are coordinate-sensitive.** Drag-to-draw needs pixel math. Zoom, scrollbars, and the floating toolbar complicate things. Mitigation: a `canvasDrag(start, end)` helper that computes canvas-relative coordinates from a DOM bounding box, not screen coordinates. Should land in `selectors.ts` alongside the rest of the test-only helpers.

2. **Debounced writes are racey.** A test that edits and immediately reads disk will miss the write. Mitigation: always `await waitForSaved()` before filesystem assertions. Do not add `page.waitForTimeout` calls — those are the fastest path to flaky tests.

3. **Electron auto-updater / protocol handlers / native dialogs.** File pickers, confirm dialogs, and the `scamp-asset://` protocol all need stubs. Playwright's Electron API can intercept dialogs via `electronApp.evaluate(...)` — we'll encapsulate that in a `stubDialog(result)` helper in `fixtures/app.ts`.

4. **`node-pty` on CI.** Terminal specs depend on native modules that might not rebuild cleanly in headless CI. Marking those specs with `test.skip(process.env.CI === 'true')` is a fine escape hatch; the terminal is peripheral to the core design-tool value prop.

5. **Selectors vs. `data-testid`.** Do we want to commit to adding `data-testid` attributes to the codebase, or stay role/text-only? My recommendation is the hybrid above, but if the user wants to stay testid-free we'll need more custom `locator()` chains and some suites will get noticeably more brittle.

6. **Build time.** `npm run build` takes ~15–20s locally. Every `npm run test:e2e` pays that cost. If we want sub-second iteration we can add a `test:e2e:nobuild` variant that assumes `out/` is fresh — useful while authoring specs.

7. **Visual regression.** Not in this plan. Flagging so we remember to decide later.

---

## Questions for review before implementation starts

1. **Harness approach**: OK with the `SCAMP_E2E=1`-guarded env var override to skip the start-screen boilerplate for most tests (Option A above)? - yes
2. **Selectors**: OK with adding `data-testid` attributes where role queries fall short, or do you want a hard no-testid constraint? - yes
3. **Phasing**: Is the 7-phase breakdown roughly right, and is Phase 2 (core canvas + code-output) the right starting point after harness? - yes
4. **Terminal specs on CI**: Acceptable to skip-on-CI if `node-pty` is a problem, or do we want to invest in making them work everywhere from day one? - yes
5. **Failure-path coverage**: Anything I've treated as "not covered" (installer, `agent.md` content, visual regression) that you actually want in-scope for this round? this plan is good as is

Once these are answered I'll open the first PR with Phase 1 only — harness + the `getting-started` smoke spec — so the infrastructure can be reviewed before spec writing ramps up.
