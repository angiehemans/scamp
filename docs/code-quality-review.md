# Code Quality Review — Scamp

_Synthesis of four parallel reviews: architecture & file size, code quality & reuse, security, readability & usability. Date: 2026-05-28._

## Executive summary

- **Scamp's pure-logic core is in excellent shape.** `src/renderer/lib/` files (element, parseCode, generateCode, parsers) are well-documented, purity contracts are stated up front, naming is self-explanatory. Cold-reading any of these takes under a minute. Keep doing this.
- **The React shell and the central store are the weak spots.** `src/renderer/store/canvasSlice.ts` (2203 lines) bundles ~10 unrelated domains. `src/renderer/src/components/ProjectShell.tsx` (2157 lines) is a god-component owning state for ~9 unrelated flows. Both are the files most likely to be touched in any session, which makes them the worst place for unrelated concerns to pile up.
- **No critical security vulnerabilities.** Threat model is narrow (local-first desktop dev tool, no public surface). Defense-in-depth gaps exist — no path containment on IPC, no renderer CSP, `sandbox: false`, scamp-asset protocol fetches any absolute path — but no exploit chain today.
- **Comments and docs/notes are unusually high-signal.** The "move multi-line WHYs into `docs/notes/`" rule from CLAUDE.md is followed well in `@lib/` and the canvas. But three dangling references to `docs/known-issues.md` exist in code; the file isn't there. The save-status state machine, the round-trip contract, and the undo coverage policy all deserve their own notes.
- **A handful of CLAUDE.md rules are violated.** Multiple `!` non-null assertions (the rules forbid them), `useEffect` exhaustive-deps suppressions (forbidden), inline hex colors in `ErrorBoundary`, `console.error` and `window.alert` for failures the project says should surface through `useAppLogStore` or inline error fields.

## Top 10 prioritized fixes

Ranked by impact-vs-effort across all four review areas:

1. **Surface parse failures to the user.** `ProjectShell.tsx:417,471` and `syncBridge.ts:443` currently `console.error` and silently `resetForNewPage()`. Replace with `useAppLogStore.error()` + an inline banner. Data-loss-feeling bug; trivial fix.
2. **Add main-side path containment to file IPC.** `src/main/ipc/file.ts:30-79`, `theme.ts:22-45`, `image.ts`, `export.ts`, `projectConfig.ts`. Every absolute path from the renderer should `path.resolve()` and prefix-check against the open project root. Defense in depth; tiny code; eliminates a whole class of future regressions.
3. **Move `elementToStyle` out of `ElementRenderer.tsx:128-459` into `@lib/elementToStyle.ts`.** 330 lines of pure logic in a `.tsx` file. CLAUDE.md mandates full test coverage for `@lib/` — currently this is untested because it's in the wrong place. Mechanical move + unit tests.
4. **Split `canvasSlice.ts` into 5-6 domain slices.** Highest impact split: every consumer touches it. Suggested seams: `elementsSlice`, `selectionSlice`, `documentSlice` (active page/component), `uiSlice` (panels, sidebar, zoom), `designSystemSlice` (breakpoints, states, theme tokens), `projectSlice`.
5. **Replace `!` non-null assertions in `@lib/`.** `parsers.ts:871,875,1014` and `parseCode.ts:144,145,339,552,635`. These are in the codebase's pure-logic core that the project explicitly demands high quality from.
6. **Extract `useColorPickerContext()` and migrate sections to `controls/Button`.** The triple-read color pattern is duplicated in 5 sections (`BorderSection.tsx:24-26`, `BackgroundSection.tsx:39-41`, `TypographySection.tsx:42-44`, `ShadowsSection.tsx:37-39`, plus pass-through). The polished `controls/Button.tsx` is imported by **zero** files in `sections/` — 26 raw `<button>` declarations duplicate styling instead.
7. **Add a renderer CSP and flip `sandbox: true`.** `src/renderer/index.html` has no CSP meta; `src/main/index.ts:84-89` and `previewWindow.ts:103-111` have `sandbox: false`. Both are defense-in-depth wins. Test sandbox flip in a branch; CSP allowlist Google Fonts + `'self'` + `scamp-asset:`.
8. **Write `docs/notes/save-status-machine.md` and either create or remove `docs/known-issues.md`.** Three files reference `docs/known-issues.md` and it doesn't exist (`syncBridge.ts:406,711`, `fileConflict.ts:14`). The save-status state machine across `syncBridge` ↔ main-side `pendingWrites` is the single biggest cold-read load in the codebase.
9. **Add file-level docstring + TOC comment to `ProjectShell.tsx` and `canvasSlice.ts`.** Even a 10-line list of "this file owns these handler families" turns a 2000-line file from "read everything to understand anything" into "jump to the section you need". One-paragraph fix per file.
10. **Audit `HistoryActionKind` coverage.** `historyTypes.ts:8` enumerates kinds but `set-prop-override`, `rename-component`, `delete-component` may not push to history. Users can change a prop override, navigate, undo, and the change won't roll back. Write `docs/notes/history-coverage.md` to make the policy explicit.

---

## 1. Architecture & file size

### Monolithic files

| File | Lines | Concerns bundled |
|---|---|---|
| `src/renderer/store/canvasSlice.ts` | 2203 | element CRUD, selection, tool state, page/component editing, breakpoints, states, animation preview, zoom, panels, theme tokens, clipboard, export settings |
| `src/renderer/src/components/ProjectShell.tsx` | 2157 | page CRUD, component CRUD, theme injection, font link reconciliation, terminal lifecycle, migration banner, convert-to-component, lock-prop, delete-prop, breadcrumb, Esc handling |
| `src/shared/agentMd.ts` | 1647 | ~90% template-string constants; two `AGENT_MD_*` templates that look near-duplicate |
| `src/renderer/lib/parseCode.ts` | 1528 | TSX structure parser, CSS declarations parser, declaration→element mapper — three independent passes |
| `src/renderer/lib/generateCode.ts` | 1314 | Mirror of parseCode: TSX render, per-element CSS lines, file assembly |
| `src/renderer/lib/element.ts` | 1261 | Types (L1-665) + pure tree mutators (groupSiblings, ungroupSiblings, wrapElement, cloneElementSubtree) |
| `src/renderer/lib/parsers.ts` | 1192 | Grab-bag of CSS shorthand parsers/formatters (border, padding, radius, transition, animation, box-shadow, filter, color) |
| `src/renderer/src/canvas/ElementRenderer.tsx` | 1167 | `elementToStyle` pure builder (L128-459) + the React component (L712+) + `renderComponentSubtree` (L460-710) |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | 874 | Four mutually-exclusive pointer state machines (draw/move/resize/reorder) colocated |
| `src/renderer/src/syncBridge.ts` | 831 | Pending-write registry + write dispatch + patch dispatch + initSyncBridge (440+ lines mixing conflict reconciliation, debounced writes, three IPC listeners) |

### Suggested splits (suggested seams)

- **`canvasSlice.ts`** → `elementsSlice`, `selectionSlice`, `documentSlice`, `uiSlice`, `designSystemSlice`, `projectSlice`. Public API stays stable via Zustand `combine()`.
- **`ProjectShell.tsx`** → extract `PageSidebar`, `ComponentSidebar`, plus hooks `usePageManagement`, `useComponentManagement`, `useConvertToComponent`, `usePropTextRequests`, `useFontInjection`, `useComponentTreeCache`, `useNavigationRequests`. Top-level becomes a thin layout.
- **`parseCode.ts`** → `parseCode/tsxStructure.ts`, `parseCode/cssDeclarations.ts`, `parseCode/applyDeclarations.ts`, `parseCode/index.ts`. Mirror split for `generateCode.ts`.
- **`element.ts`** → `element/types.ts` (≤L760) + `element/tree.ts` (pure mutators L802+).
- **`parsers.ts`** → one file per shorthand (`parsers/border.ts`, `parsers/transition.ts`, etc.). Existing tests already partition this way.
- **`ElementRenderer.tsx`** → pull `elementToStyle` into `@lib/elementToStyle.ts`; pull `renderComponentSubtree` into `ComponentInstanceRenderer.tsx`.
- **`CanvasInteractionLayer.tsx`** → per-tool hooks (`useDrawInteraction`, `useMoveInteraction`, `useResizeInteraction`, `useReorderInteraction`, `useDropInsert`) + hit-test utilities into `canvasHitTest.ts`.
- **`syncBridge.ts`** → `syncBridge/pendingSaves.ts`, `syncBridge/writeDispatch.ts`, `syncBridge/externalEdit.ts` (chokidar branch L694-794), `syncBridge/themeListener.ts`.
- **`agentMd.ts`** → `src/shared/templates/{agentMd,themeCss,pageScaffold,nextConfig}.ts` + an `index.ts` re-export. Diff the two `AGENT_MD_*` constants — likely consolidatable.

### Architectural smells

- **Business logic in `ProjectShell.tsx`:** component-tree cache calls `parseCode` for every component on every project change (`ProjectShell.tsx:225-251`). Same for `persistActiveSource` (L984-1042) and `openComponent`/`exitComponentEditor` (L1054-1076) calling into `syncBridge`. This is controller-layer work in a presentational shell.
- **`canvasSlice` holds UI chrome state:** `bottomPanel`, `leftSidebarTab`, `panelMode`, `userZoom`, `openThemePanel` (`canvasSlice.ts:197-215, 592-593`) are pure UI concerns mixed with element CRUD.
- **Derived selectors in the slice:** `selectProjectColors` (`canvasSlice.ts:2189`) is a pure function over `state.elements` and belongs in `@lib/projectColors.ts`.
- **`elementToStyle` in a `.tsx` file:** `ElementRenderer.tsx:128-459` is pure data → CSSProperties. By CLAUDE.md rules this should be in `@lib/` with tests.
- **Half-applied `ipc/*.ts` + `*Ops.ts` pattern:** clean pairs are `component.ts`/`componentOps.ts`, `page.ts`/`pageOps.ts`. Inline-only files: `image.ts`, `export.ts`, `file.ts`, `project.ts`, `preview.ts`, `settings.ts`. Normalize.
- **`generateCodeLegacy` at the bottom of `generateCode.ts:1313`:** if still used, give it its own file; if dead, delete.

### Directory boundary leaks

Boundaries are mostly clean — `@lib` is pure, `@store` only depends on `@lib`/`@shared`, `src/renderer/src/` is the only React-importing area, `src/main/**` doesn't reach into renderer. Concrete leaks:

- `@store/canvasSlice` imports `DEFAULT_BODY_FONT_FAMILY` from `@shared/agentMd` (`canvasSlice.ts:22`) — should be in `@lib/defaults.ts` or `@shared/themeDefaults.ts`, not pulled from the 1647-line templates file.
- `ProjectShell.tsx` does `parseCode` + `generateCode` directly (lines 27-28, 225-251). Not a strict violation but renderer presentational layer doing renderer sync-engine work.
- `syncBridge.ts` lives at `src/renderer/src/syncBridge.ts` next to `App.tsx` rather than in its own folder under `@lib/` or `@store/`. It mixes infrastructure (pending-write tracking, IPC) and document logic.

---

## 2. Code quality & reuse

### CLAUDE.md rule violations

| Rule | Violations | Where |
|---|---|---|
| No `!` non-null assertions | 7+ | `parsers.ts:871,875,1014`; `parseCode.ts:144,145,339,552,635`; `ElementTree.tsx:43`; `HistoryPanel.tsx:63` |
| No `console.log` for debugging | 10+ | `App.tsx:49`; `ProjectShell.tsx:417,471` + others |
| `useEffect` deps complete, no suppressions | 3 | `ProjectShell.tsx:302,807,839` (`// eslint-disable-next-line react-hooks/exhaustive-deps`) |
| Reference theme variables, not hex | several | `ErrorBoundary.tsx:36-83` (`#1a1a1a`, `#ff6b6b`, `#333`, `#555`, `#f5f5f7`); `LayoutSection.tsx:156-172` (`color: '#888'`) |
| Never use `window.alert` | 1 | `ProjectShell.tsx:961-964` `handleDeletePage` — sibling handlers use `setPageEditError`; only delete falls back to alert |

### Reuse opportunities

- **Color-picker triple-read repeated in 5 sections:** `projectColors`/`themeTokens`/`openThemePanel` + the `projectColors.length > 0 ? projectColors : undefined` ternary appears identically in `BorderSection.tsx:24-26`, `BackgroundSection.tsx:39-41`, `TypographySection.tsx:42-44`, `ShadowsSection.tsx:37-39`. Extract `useColorPickerContext()` or absorb into `ColorInput`.
- **Section buttons not using `controls/Button`:** 26 raw `<button type="button">` declarations across `sections/` files. The polished `Button.tsx` with variants/sizes/`fullWidth` is imported by **zero** section files. Each section's CSS module re-declares button styling.
- **`hasContent ? groupToggle : undefined` repeated in 6 sections:** identical predicate-gating in `Border`, `Background`, `Typography`, `Shadows`, `Filters`, `Transitions`, `Animation` sections. Push into `useGroupToggle(elementId, group, hasContent)`.
- **List-row update/remove/add boilerplate:** `ShadowsSection.tsx:52-62`, `FiltersSection.tsx:79-101`, `TransitionsSection.tsx:84-96` reimplement the same generic over `ReadonlyArray<T>`. Extract `useListField<T>(getList, setList)`.
- **`e instanceof Error ? e.message : String(e)`:** appears 5+ times in `ProjectShell.tsx` (873, 897, 945, 1103, 1169) plus elsewhere. One helper.
- **`customProperties` spread-and-delete dance:** `BackgroundSection.tsx:71-79, 82-89, 91-98` and several handlers manually splat-and-delete keys. A `patchCustomProperties(elementId, patch)` store action would eliminate four near-identical handlers and a "forgot to delete" bug class.

### Component design issues

- **`ProjectShell.tsx` god component:** 25 `useState`, 23+ `useEffect`, 57 hook usages, 9+ unrelated flows. See §1 for the split.
- **Sub-components colocated with parents in same file:** `ElementSection.tsx`, `FiltersSection.tsx` (`FilterRow`), `ShadowsSection.tsx` (`ShadowRow`, `ShadowColorRow`). CLAUDE.md says "one component per file." Pick a rule and apply it.
- **Prop drilling:** `ShadowRow` (`ShadowsSection.tsx:122-131`) takes 8 props, 6 of which are pure pass-through from store reads in the parent. After `useColorPickerContext()` extraction, drops to 3.
- **Inline empty-state JSX:** `LayoutSection.tsx:156-172`, `FiltersSection.tsx:121-126`, `ShadowsSection.tsx:74-83` all hand-roll the same "disabled" / "no items" pattern. Extract `<SectionEmptyState>`.

### Type safety holes

- **`Record<string, unknown>` casts as escape hatches:**
  - `canvasSlice.ts:817,819` — `(basePatch as Record<string, unknown>)[key] = patch[key]` defeats `Partial<ScampElement>` typing in `applyPatchWithAxisRouting`.
  - `ElementRenderer.tsx:544, 1069` — `const props: Record<string, unknown>` loses every downstream check.
- **`SegmentedControl` Option type:** the doc says `ariaLabel` is required when `label` is a non-text ReactNode; the type doesn't enforce it. Make it a discriminated union (`{label: string}` | `{label: ReactNode; ariaLabel: string}`) so missing aria-labels fail at compile time.

---

## 3. Security

**Threat model:** Local-first desktop dev tool. Concerns are (a) hostile project files on disk and (b) external editors/agents writing into the watched tree. No public network surface; no auto-update from untrusted origins; no public IPC. With that scope, **no critical vulnerabilities found**.

### Critical
None.

### Moderate (defense-in-depth)

- **No path containment on any IPC path argument** (`file.ts:30-79`, `theme.ts:22-45`, `image.ts:21-43`, `export.ts:30-99`, `projectConfig.ts:18-34`). Every file IPC takes absolute paths from the renderer and acts on them with zero check that they live inside the open project. A future renderer bug could write/read anywhere the user can. `path.resolve()` + prefix check is tiny code.
- **`scamp-asset://` protocol fetches any absolute file path** (`src/main/index.ts:165-171`). Accepts whatever path is in the URL and `net.fetch(file://<path>)` it with `bypassCSP: true`. A renderer-side bug could exfiltrate anything via `fetch('scamp-asset://localhost/etc/passwd')`. Constrain to known asset roots (project's `public/assets`, `assets/`).
- **Terminal `cwd` renderer-supplied and unvalidated** (`src/main/ipc/terminal.ts:42-61`). Spawns shells wherever the renderer asks. Pin to active project root, validated main-side.
- **No renderer CSP** (`src/renderer/index.html:1-23`). Pulls Google Fonts CSS over HTTPS; hostile dev network could inject CSS that leaks selection state. Add a CSP meta allowing `https://fonts.googleapis.com`, `https://fonts.gstatic.com`, `'self'`, and `scamp-asset:` for `img-src`.
- **`webPreferences.sandbox: false`** on both main window (`src/main/index.ts:84-89`) and preview window (`previewWindow.ts:103-111`). With `contextIsolation: true` + `nodeIntegration: false`, the renderer can't `require()` directly, but a Chromium-renderer RCE wouldn't be OS-sandboxed. Worth flipping in a branch.
- **Preview window enables `webviewTag` and `allowpopups`**; `did-attach-webview` routes popups through `shell.openExternal` (good) but doesn't clamp attached webview `webPreferences` via `will-attach-webview`.
- **Chokidar follows symlinks by default** (`src/main/watcher.ts:49-62`). Set `followSymlinks: false`.
- **`agent.md` / `CLAUDE.md` silently overwrite user edits** (`src/main/ipc/projectScaffold.ts:337-361`). Not security per se but a data-loss risk. Opt-out via `scamp.config.json`.

### Low

- `src/main/sentry.ts` PII scrubbing only catches `/Users/<name>`, `/home/<name>`, `C:\Users\<name>`. Project paths anywhere else (`/opt/work/secret-project/...`) leak. Scrub any path matching the open project root regardless of prefix.
- No SRI on Google Fonts (`src/renderer/index.html:11-14`). Generally impractical for server-rotated stylesheets; lock font family list to reduce surface.
- `fs.fsync` before rename in `atomicWrite` (`file.ts:23-28`) would add power-loss resilience.
- `imageOps.ts:45-75` `copyImage` accepts any `sourcePath` from the renderer. Today always comes from a `chooseImage` dialog; theoretical.

### What's done well

- `contextIsolation: true`, `nodeIntegration: false`, narrow preload bridge.
- `setWindowOpenHandler` on both windows routes external links through `shell.openExternal`.
- Project / page / component names re-validated main-side against tight regexes — blocks `..` and slashes.
- HTML escape on text in `generateCode.ts:88-94`; per-tag attribute deny list in `ElementRenderer.tsx:88-93` strips `href`/`action`/`open`.
- SVG content rendered as inert `<div>` on canvas — no raw HTML injection sink.
- Sentry init opt-in gated; thoughtful `beforeSend` drops `user`/`request`/`abs_path`.
- Atomic write via tmp + rename — external readers never see torn writes.
- Permission handler allows only `local-fonts` (`src/main/index.ts:156-163`).

---

## 4. Documentation & readability

### What's working

- **Comments are high-signal in `@lib/` and the canvas.** File-level docstrings state purity contracts (`generateCode.ts:26-36`: "Reads no external state — no Date.now, no Math.random"). Inline WHYs protect fragile invariants (`syncBridge.ts:554-559` on `toEditTarget` identity). Discriminated unions are documented at the type level so an agent reading the type alone knows what each field means.
- **`docs/notes/` quality is excellent.** Frontmatter consistent, narratives lead with what's surprising, bug stories tie code to history (the convert-to-component disappearing bug is a great example).
- **Naming is self-documenting overall.** `armTargetSwapSuppression`, `flushPendingPageWrite`, `componentTrees`, `lastSerializedTsx` — no cryptic abbreviations.

### What's missing

- **Three dangling references to `docs/known-issues.md`** in `syncBridge.ts:406,711` and `fileConflict.ts:14`. File doesn't exist. Either create it or remove the references.
- **No `docs/notes/save-status-machine.md`** despite `syncBridge` ↔ main `pendingWrites` being the single biggest cold-read load. Comments at `syncBridge.ts:91-96, 151-160, 215-225` are good locally but no overall picture.
- **No round-trip contract note.** CLAUDE.md states the `parseCode`/`generateCode` invariants; the *failure modes* (what happens on agent-written non-Scamp JSX, malformed HTML, missing CSS module) live nowhere.
- **No history-coverage note.** `historyTypes.ts:8-33` enumerates `HistoryActionKind` but the *policy* (which mutations push, which don't, and why) is implicit.
- **No file-level docstring on `ProjectShell.tsx` or `canvasSlice.ts`.** The first thing an agent sees is `import` lines, not "this file owns these N concerns."

### Cold-read friendliness

Strong for `lib/`. Weak for the React shell and the central store. Adding a 10-line TOC comment to the two big monoliths is a quick win that pays off until the splits happen.

---

## 5. Usability & correctness

- **Parse failures are silent.** `ProjectShell.tsx:417-421, 471-479` and `syncBridge.ts:443-446` log to console and (in the first two) silently `resetForNewPage()`. The user loses their canvas with no UI surface. Wire through `useAppLogStore.error()` + an inline banner.
- **`handleDeletePage` uses `window.alert`** (`ProjectShell.tsx:961-964`). Sibling handlers (`handleCreatePage`, `handleRenamePage`) use `setPageEditError`; only delete falls back. Asymmetry — fix.
- **History coverage holes.** `set-prop-override`, `rename-component`, `delete-component` may not push to history. User can change a prop override, navigate, undo, change doesn't roll back. Audit.
- **Save flow race smells.**
  - `ACK_WATCHDOG_MS = 2000` (`syncBridge.ts:235-249`) — if the OS is briefly slow (Spotlight indexing), users see a spurious "Save failed" with the file actually saved. No retry beyond the manual button.
  - `App.tsx:136-141` swallows `readProject` failures with bare `catch {}`. If a user's project folder gets renamed mid-session, every save goes to the wrong path silently.
- **Accessibility gaps.**
  - `ZoomControls.tsx:24-38` icon-only +/-/% buttons have no `aria-label` — screen readers hear "minus", "plus".
  - `ErrorBoundary.tsx:36-83` uses inline hex colors + `system-ui` font instead of theme tokens. Plausibly justified as "fail-safe if CSS modules fail" but the comment doesn't say that.
  - `SaveStatusIndicator.tsx:74` `title={state.message}` is the only place the actual save error message is exposed — title attrs are not reliably discoverable.
- **Page name validation looser than component name.** `componentNameFromPage` is forgiving; if a user creates a page named `123!@#`, the slug→component-name path may produce odd output.
- **No confirmation on `deletePage` / `deleteComponent`.** Verify the renderer has a confirm dialog and that `componentName` can't resolve to `..` despite the regex.

---

## What's working well (don't lose this)

- Pure-logic core (`@lib/`) is documented like a library, not internal code. Keep treating it that way.
- The `ipc/*.ts` (handler) + `*Ops.ts` (logic) pattern, where it's applied, is a clean main-process boundary. Apply it consistently.
- `docs/notes/` quality bar is high — every existing note pays its weight.
- Security primitives (atomic writes, escape-html in code emit, attribute deny list, opt-in Sentry, validated names in main, narrow preload bridge) all reflect care.
- `useResolvedElement` is a well-designed abstraction.
- E2E test harness with project/window fixtures is genuinely useful for catching cross-cutting bugs.
- Two-process `.ts` + `.js` shim pattern documented in CLAUDE.md as a known sharp edge — the documentation is the right mitigation since the shim is load-bearing for the tooling.

---

## Appendix: file size table

| File | Lines | Priority |
|---|---|---|
| `src/renderer/store/canvasSlice.ts` | 2203 | Split |
| `src/renderer/src/components/ProjectShell.tsx` | 2157 | Split |
| `src/shared/agentMd.ts` | 1647 | Split (mostly templates) |
| `src/renderer/lib/parseCode.ts` | 1528 | Split when convenient |
| `src/renderer/lib/generateCode.ts` | 1314 | Split when convenient |
| `src/renderer/lib/element.ts` | 1261 | Split into types + tree |
| `src/renderer/lib/parsers.ts` | 1192 | Split per shorthand |
| `src/renderer/src/canvas/ElementRenderer.tsx` | 1167 | Extract `elementToStyle` |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | 874 | Per-tool hooks |
| `src/renderer/src/syncBridge.ts` | 831 | Split + own folder |
