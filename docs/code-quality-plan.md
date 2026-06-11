# Code Quality Improvement Plan

_Phased rollout of the work surfaced in `docs/code-quality-review.md`. Phases are ordered by ease — start at Phase 1, ship, then move down. Each task lists its source file:line refs so they're easy to find in the review._

## Ground rules

- **One PR per task** unless explicitly grouped. Small PRs review faster and let CI catch regressions in isolation.
- **Tests gate every phase that touches `@lib/`** — CLAUDE.md mandates full coverage there. Adding a unit test alongside the change is part of "done."
- **Each phase is independently shippable.** Skipping a phase doesn't block later ones, except where called out under "Depends on."
- **Effort:** S = <2 hours, M = half-day, L = full day or more, XL = multi-day.
- **Risk:** Low = mechanical / additive. Medium = touches behaviour but local. High = cross-cutting, needs a careful follow-up.

---

## Phase 1 — Quick wins (low risk, high readability)

> **Status: ✅ COMPLETE (2026-06-09).** All 10 tasks done; full typecheck (node + web) and the 1441-test suite pass. New tested helpers: `@shared/errorMessage`, `@lib/safeAccess`. New notes: `docs/notes/{save-status-machine,round-trip-contract,history-coverage}.md`. New component: `ParseErrorBanner`. Note: several source line refs below were stale (the codebase had shifted) — 1.1 was already resolved in a prior session, and the `!`-assertion set in 1.8 was larger than listed. Changes are staged in the working tree on `release-0-3-5`, not yet committed/split into PRs.

**Goal:** Pay down the cheap stuff first. Most of these are <1 hour each, lots of which are docs or 5-line code changes. Done in a week.

### 1.1 Resolve the dangling `docs/known-issues.md` references — S, Low
Three places reference a file that doesn't exist:
- `src/renderer/src/syncBridge.ts:406, 711`
- `src/main/ipc/fileConflict.ts:14`

**Action:** Either create `docs/known-issues.md` (the file was implied by the prior session's IPC conflict-detection work) or remove the references and inline the relevant context. Recommend creating it with sections for the three issues already coded around: concurrent-write race, late-chokidar echo, and patch-package persistence.

**Acceptance:** No code reference to a missing doc; the existing `// see docs/...` convention from CLAUDE.md is preserved.

### 1.2 Add file-level docstring + TOC to `ProjectShell.tsx` and `canvasSlice.ts` — S, Low
Both files are >2000 lines with no orientation at the top.

**Action:** Add a 10-15 line block-comment header listing the handler families / state domains, with rough line ranges. Example for `ProjectShell.tsx`:
```
// Owns project-level UI state. Sections (in roughly this order):
//   L100-200  state hooks
//   L218-303  component-tree cache + navigation request consumers
//   L417-490  parseCode failure handling
//   L852-980  page CRUD handlers
//   L1054-1107 component editor entry/exit
//   L1084-1500 component CRUD handlers
//   L1538-1600 header + breadcrumb render
//   L1600-end main render tree
```

**Acceptance:** A new reader can locate a feature without opening Outline view.

### 1.3 Write `docs/notes/save-status-machine.md` — M, Low
Single biggest cold-read load in the codebase. Cover:
- The renderer-side `pendingSaves` / `earlyAcks` (`syncBridge.ts:91-160`).
- The main-side `pendingWrites` tracker.
- The ack watchdog (`syncBridge.ts:235-249`, `ACK_WATCHDOG_MS = 2000`).
- The conflict reconciliation path (`syncBridge.ts:443+`).
- The late-chokidar echo guard.
- The state-machine transitions in `saveStatusSlice.ts`.

**Acceptance:** An agent can resolve a "Save failed" report by reading one doc, not five files.

### 1.4 Write `docs/notes/round-trip-contract.md` — S, Low
Inventory the invariants that `parseCode(generateCode(x)) === x` must preserve and the failure modes when input is non-Scamp JSX. CLAUDE.md states the contract; the *failure modes* live nowhere.

**Acceptance:** Lists each invariant (default omission, customProperties passthrough, unknown CSS goes to customProperties, text HTML-escape) with a one-line example of what breaks if it isn't honoured.

### 1.5 Write `docs/notes/history-coverage.md` — S, Low
Document which mutations push to the undo stack and which don't, and why. Build the list by grepping `commitElementsToHistory` callers in `canvasSlice.ts`.

**Acceptance:** Each `HistoryActionKind` has a one-liner. Operations that *don't* push (settings, navigation, theme edits) are listed too, with rationale.

### 1.6 Surface parse failures to the user — S, Medium
Today `ProjectShell.tsx:417, 471` and `syncBridge.ts:443` log `console.error` and silently `resetForNewPage()`. The user loses their canvas with no UI.

**Action:** Route through `useAppLogStore.error(...)` + an inline banner in the canvas chrome. CLAUDE.md prohibits `console.log` for debugging — this is the same hole.

**Acceptance:** Open a project with a hand-malformed `app/page.tsx`; user sees a clear "We couldn't parse this page; canvas is showing the last good state" message, not a blank canvas.

### 1.7 Replace `window.alert` in `handleDeletePage` — S, Low
`ProjectShell.tsx:961-964` uses `window.alert`. Sibling handlers (`handleCreatePage`, `handleRenamePage`) use `setPageEditError` — the asymmetry is a code-review escapee.

**Acceptance:** Delete failure surfaces inline like create/rename failures.

### 1.8 Replace `!` non-null assertions in `@lib/` — S, Medium
CLAUDE.md forbids `!`. Violations:
- `src/renderer/lib/parsers.ts:871, 875, 1014`
- `src/renderer/lib/parseCode.ts:144, 145, 339, 552, 635`
- (Also `ElementTree.tsx:43`, `HistoryPanel.tsx:63` — fix while you're in there.)

**Action:** Replace each `x!` with either a proper narrowing guard, a `??` fallback with a typed default, or a single-line "if-undefined-throw" with a clear error message.

**Acceptance:** `grep '!\\.\\|!]\\|![ ;]' src/renderer/lib/` returns no app-code matches; `npm run typecheck` still passes.

### 1.9 Add `aria-label` to `ZoomControls.tsx` icon-only buttons — S, Low
`ZoomControls.tsx:24-38` has `title` but no `aria-label` on +/-/% — screen readers hear "minus", "plus", "fit".

**Acceptance:** Each icon button has an `aria-label` matching its tooltip.

### 1.10 Extract an `errorMessage(e: unknown): string` helper — S, Low
`e instanceof Error ? e.message : String(e)` repeats 5+ times in `ProjectShell.tsx` (873, 897, 945, 1103, 1169) plus other files.

**Action:** Add to a new `src/shared/errors.ts` or to `@lib/errorMessage.ts`. Replace inline expressions.

**Acceptance:** No duplicate copies of the ternary remain.

---

**Phase 1 total estimate:** ~2-3 days of work. Each task is independently shippable. Recommend running them in roughly this order so the docs are written before the bigger refactors land.

---

## Phase 2 — Security hardening (defense in depth)

> **Status: ✅ COMPLETE (code) — needs a manual security/regression pass before merge.** Typecheck (node + web) and the 1456-test suite pass; production build succeeds with the CSP injected into the main window only. New: `src/main/ipc/pathContainment.ts` (`resolveInsideProject` / `assertInsideActiveProject`, 9 tests), `docs/notes/sandbox-tradeoffs.md`. Key design deltas from the plan, all because the plan's uniform "containment everywhere" would have broken legitimate flows: **(a)** the active project root is sourced from the watcher's `watchedPath` (main-tracked, fail-closed) — validating a renderer path against a renderer-supplied root gives no protection; **(b)** export writes to a dialog-chosen path (anywhere the user picks), so it's guarded by a session allowlist of dialog-approved paths, not project containment; **(c)** image *source* is a user-chosen file (left uncontained); only the copy *destination* (`projectPath`) is; **(d)** the CSP ships as a build-time `<meta>` (prod only, main window only) via a `transformIndexHtml` hook, not a static tag — a static strict CSP breaks Vite dev HMR, and a global session header would break the preview window's `<webview>`; **(e)** 2.7 flipped sandbox on the **main window only** — preview deferred (webview interaction needs runtime verification, documented in the note). **Manual pass still required** (the plan flagged this): exercise file save, theme/config write, image insert, export, terminal, fonts, preview, and a packaged sandbox run; confirm no CSP console violations.

**Goal:** No known exploitable issues today; close the easy defense-in-depth gaps so a future renderer-side bug doesn't escalate.

**Depends on:** Phase 1 is independent; you can do Phase 2 in parallel. But these need careful manual testing because they restrict things that currently work.

### 2.1 Main-side path containment on file IPC — M, Medium
Every absolute path the renderer sends should resolve to inside the active project.

**Action:** Add a `resolveInsideProject(path, projectRoot)` helper in `src/main/ipc/pathContainment.ts` that:
1. `path.resolve()` the input.
2. Confirms the resolved path starts with `path.resolve(projectRoot) + path.sep`.
3. Throws a clear IPC error if not.

Apply at the top of every handler in:
- `src/main/ipc/file.ts:30-79` (`handleWrite`, `handlePatch`)
- `src/main/ipc/theme.ts:22-45`
- `src/main/ipc/image.ts:21-43`
- `src/main/ipc/export.ts:30-99`
- `src/main/ipc/projectConfig.ts:18-34`

**Acceptance:** Unit tests covering the resolver (happy path + `..` escape + symlink + Windows drive). A malicious IPC call with `/etc/passwd` is rejected; renderer surfaces the error via the existing save-status flow.

### 2.2 Lock down `scamp-asset://` protocol — M, Medium
`src/main/index.ts:165-171` currently `net.fetch(file://<arbitrary-path>)`s anything in the URL.

**Action:** Resolve the URL path against the active project's `public/assets` (and `assets/` for legacy format). Reject anything outside.

**Acceptance:** `scamp-asset://localhost/etc/passwd` returns 404; legitimate asset paths still load.

### 2.3 Add a renderer CSP — S, Medium
`src/renderer/index.html` has no `<meta http-equiv="Content-Security-Policy">`.

**Action:** Add a CSP meta tag allowing:
- `default-src 'self'`
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` (CodeMirror needs inline styles; document if you tighten further)
- `font-src https://fonts.gstatic.com data:`
- `img-src 'self' scamp-asset: data:`
- `connect-src 'self'`
- `script-src 'self'`

**Acceptance:** Devtools console shows no CSP violations during normal use. Manually verify export, font picker, image insertion still work.

### 2.4 Pin terminal `cwd` to the active project root — S, Medium
`src/main/ipc/terminal.ts:42-61` spawns shells wherever the renderer asks.

**Action:** Validate `cwd` against the open project root using the same `resolveInsideProject` helper from 2.1.

**Acceptance:** Terminal still spawns at the project root for legitimate launches; rejects arbitrary `cwd`.

### 2.5 `followSymlinks: false` on chokidar — S, Low
`src/main/watcher.ts:49-62`. Symlinks shouldn't be followed out of the project.

**Acceptance:** A symlinked file inside a project is no longer watched; project files still get save acks.

### 2.6 Tighten Sentry path scrubbing — S, Low
`src/main/sentry.ts` scrubbing only catches `/Users/<name>`, `/home/<name>`, `C:\Users\<name>`. Project paths anywhere else (`/opt/work/secret-project/...`) leak.

**Action:** Add a runtime-configurable scrubber that strips the resolved project root from any string in the event payload.

**Acceptance:** Manually triggered crash payload (in dev) shows the project root replaced with `<project>`.

### 2.7 Try `sandbox: true` in a branch — M, Medium-High
`src/main/index.ts:84-89` and `previewWindow.ts:103-111` set `sandbox: false`. With `contextIsolation: true` + `nodeIntegration: false`, the renderer can't `require()` directly, but flipping sandbox on adds OS-level isolation.

**Action:** Flip the flag in a branch, run the e2e suite, manually exercise terminal + preview + image insertion. If anything breaks, document why before reverting.

**Acceptance:** Either sandbox is on and everything works, or there's a `docs/notes/sandbox-tradeoffs.md` explaining what couldn't be flipped.

---

**Phase 2 total estimate:** ~2-3 days. Items 2.1-2.6 are mostly mechanical; 2.7 is the wildcard.

---

## Phase 3 — Reuse and consolidation (no behaviour changes)

**Goal:** Reduce duplication, enforce CLAUDE.md rules, make the section files less bloated. No new features; no behaviour changes.

**Depends on:** None, but easier after Phase 1 so docs are in place.

### 3.1 Extract `useColorPickerContext()` — S, Low
The triple-read pattern (`projectColors`, `themeTokens`, `openThemePanel`) plus the `projectColors.length > 0 ? projectColors : undefined` ternary repeats in:
- `BorderSection.tsx:24-26`
- `BackgroundSection.tsx:39-41`
- `TypographySection.tsx:42-44`
- `ShadowsSection.tsx:37-39` (also passed through to `ShadowRow` at 92-94)

**Action:** Add hook in `@store/hooks/useColorPickerContext.ts` returning `{ projectColors, themeTokens, onOpenTheme }` ready to spread into `ColorInput`. Migrate all four callsites.

**Acceptance:** The duplicated three-read pattern remains in zero section files.

### 3.2 Extract `useGroupToggle(elementId, group, hasContent)` — S, Low
The `(predicate || !groupToggle.isOn) ? groupToggle : undefined` pattern repeats in 6+ sections (Border, Background, Typography, Shadows, Filters, Transitions, Animation).

**Acceptance:** Each section passes a `hasContent` boolean; the gating lives in one place.

### 3.3 Extract `useListField<T>(getList, setList)` — S, Low
`ShadowsSection.tsx:52-62`, `FiltersSection.tsx:79-101`, `TransitionsSection.tsx:84-96` re-implement update/remove/add helpers over `ReadonlyArray<T>`.

**Acceptance:** Returns `{ update(idx, patch), remove(idx), add() }`. Used by all three sections.

### 3.4 Add `patchCustomProperties` store action — S, Low
`BackgroundSection.tsx:71-79, 82-89, 91-98` manually splat-and-delete keys on `element.customProperties`. Recurs anywhere custom props are written. A forgotten delete leaves stale CSS — a bug class.

**Action:** Add `patchCustomProperties(elementId, patch)` to `canvasSlice` (or to the eventual `elementsSlice` once Phase 5 lands). Migrate handlers.

**Acceptance:** No callsite manually spreads-and-deletes `customProperties` anymore.

### 3.5 Migrate section `<button>`s to `controls/Button.tsx` — M, Low
26 raw `<button type="button">` declarations in `sections/`. `controls/Button.tsx` with variants/sizes/`fullWidth` is imported by zero section files. Each section module re-declares button styling.

**Action:** Audit `controls/Button.tsx` for missing variants (probably needs an "add-row" and "remove-row" variant matching today's `rowAddButton` / `rowRemoveButton` styles). Migrate sections one at a time.

**Acceptance:** No raw `<button>` in `sections/`; CSS-module button rules in each section file are deleted.

### 3.6 Extract `<SectionEmptyState>` — S, Low
Inline empty-state JSX in `LayoutSection.tsx:156-172`, `FiltersSection.tsx:121-126`, `ShadowsSection.tsx:74-83`.

**Acceptance:** Shared component; the inline `color: '#888'` hex literal in `LayoutSection` is replaced with `var(--text-secondary)` or equivalent.

### 3.7 Replace inline hex literals in `ErrorBoundary.tsx` — S, Low
`ErrorBoundary.tsx:36-83` uses `#1a1a1a`, `#ff6b6b`, `#333`, `#555`, `#f5f5f7` and `system-ui` font, against CLAUDE.md's theme-token rule.

**Action:** Either (a) move to a CSS module with theme variables, or (b) add a one-line comment explaining the inline choice is a fail-safe for when CSS modules themselves fail to load.

**Acceptance:** Either no inline hex, or a documented justification.

### 3.8 Tighten `SegmentedControl` Option type to a discriminated union — S, Low
`SegmentedControl.tsx:5-16` Option type lets `ariaLabel` be undefined even when `label` is a non-text ReactNode. The doc says it's required; the type doesn't enforce.

**Action:** `{ value, label: string }` | `{ value, label: ReactNode, ariaLabel: string }`.

**Acceptance:** `npm run typecheck` fails if an icon-only option lacks `ariaLabel`.

### 3.9 Fix `Record<string, unknown>` casts — M, Medium
- `canvasSlice.ts:817, 819` (`applyPatchWithAxisRouting`) — defeats `Partial<ScampElement>` typing.
- `ElementRenderer.tsx:544, 1069` — React props object typed loosely, cascades downstream.

**Action:** For the slice case, use a `(keyof ScampElement)[]` reducer. For the renderer case, type as `JSX.IntrinsicAttributes & Record<string, unknown>` with `Record` *additive* (forwarded `data-*` attrs only) rather than as the base type.

**Acceptance:** No `as Record<string, unknown>` left in those files. Type errors expose any latent wrong-keyed patches.

### 3.10 Remove `useEffect` exhaustive-deps suppressions in `ProjectShell.tsx` — M, Medium
Three suppressions at lines 302, 807, 839. CLAUDE.md forbids them.

**Action:** Each suppression reads a stale closure ref. Rewrite via `useRef` + an effect that reads `ref.current`.

**Acceptance:** No `// eslint-disable-next-line react-hooks/exhaustive-deps` in the file.

---

**Phase 3 total estimate:** ~3-4 days. Each item is independent; can be parallelized across PRs.

---

## Phase 4 — File splits (pure logic first)

**Goal:** Break up the easier-to-split monoliths (the pure-logic ones), where the seams are already obvious. Defer the React + store splits to Phase 5.

**Depends on:** Phase 1 docs make this easier to navigate, but not strictly required.

### 4.1 Move `elementToStyle` to `@lib/elementToStyle.ts` + tests — M, Low
`ElementRenderer.tsx:128-459` is 330 lines of pure data → CSSProperties living in a `.tsx`. CLAUDE.md mandates full coverage for `@lib/`; currently this is untested because it's in the wrong place.

**Action:** Move with helpers (`resolveTokenValue`, `canvasRenderTag`, `CANVAS_SKIP_ATTRS_BY_TAG`). Add unit tests covering: widthMode branches, flex/grid parent layouts, root vs instance-inner, transform formatting, animation/transition resolution.

**Acceptance:** `ElementRenderer.tsx` is ~330 lines shorter; new test file passes; e2e suite still passes (no behaviour change).

### 4.2 Split `element.ts` into types + tree — S, Low
`element.ts:1-665` is types; `element.ts:802+` is pure mutators.

**Action:** `src/renderer/lib/element/types.ts` and `src/renderer/lib/element/tree.ts`. Keep `src/renderer/lib/element.ts` as a barrel re-export so existing imports don't break.

**Acceptance:** Both new files <800 lines; no import sites changed.

### 4.3 Split `parsers.ts` per shorthand — M, Low
One file per shorthand: `parsers/border.ts`, `parsers/padding.ts`, `parsers/borderRadius.ts`, `parsers/transition.ts`, `parsers/animation.ts`, `parsers/boxShadow.ts`, `parsers/filter.ts`, `parsers/color.ts`.

**Action:** Existing tests already partition this way — should mostly be a `mv` exercise. Re-export from `parsers/index.ts`.

**Acceptance:** No file in `parsers/` >250 lines; tests still pass without modification.

### 4.4 Split `parseCode.ts` — M, Low
Internal factoring already clean. Split into `parseCode/tsxStructure.ts` (L482-893), `parseCode/cssDeclarations.ts` (L935-1107), `parseCode/applyDeclarations.ts` (L1109-1369), `parseCode/index.ts` (entry at L1371).

**Acceptance:** Same as 4.3 — no behaviour change, no test modifications, all integration tests pass.

### 4.5 Split `generateCode.ts` — M, Low
Mirror of 4.4. `generateCode/tsx.ts` (renderJsx, generateTsx), `generateCode/declarations.ts` (elementDeclarationLines, breakpointOverrideLines), `generateCode/css.ts` (generateCss), `generateCode/index.ts`. Decide whether `generateCodeLegacy` (`generateCode.ts:1313`) is dead — if dead, delete; if not, `generateCode/legacy.ts`.

### 4.6 Split `agentMd.ts` into a templates folder — S, Low
`src/shared/agentMd.ts` is 1647 lines, ~90% template-string constants.

**Action:** `src/shared/templates/{agentMd,themeCss,pageScaffold,nextConfig}.ts` + an `index.ts` re-export. Diff the two `AGENT_MD_*` constants; if they're near-duplicates, consolidate.

**Acceptance:** Each template file <500 lines; consumers import from the same path (`@shared/agentMd` continues to work via re-export or migration).

### 4.7 Normalize the `ipc/*.ts` + `*Ops.ts` pattern — M, Low
The pattern is half-applied. Clean pairs: `component.ts`/`componentOps.ts`, `page.ts`/`pageOps.ts`. Inline-only: `image.ts`, `export.ts`, `file.ts`, `project.ts`, `preview.ts`, `settings.ts`.

**Action:** Extract pure logic into a matching `*Ops.ts` for each. Handler files become thin IPC adapters that delegate.

**Acceptance:** Every file in `src/main/ipc/*.ts` either is itself an `Ops` or has a corresponding `*Ops.ts`. Main-side unit tests target the `*Ops` exclusively.

---

**Phase 4 total estimate:** ~3-4 days. Mostly mechanical. Run the full test suite (unit + integration + e2e) after each split.

---

## Phase 5 — The big refactors (highest risk, biggest payoff)

**Goal:** Split the two files that drive the bulk of merge-conflict pain: `canvasSlice.ts` and `ProjectShell.tsx`. Plus the canvas interaction layer and sync bridge.

**Depends on:** Phase 1 docs (especially save-status-machine) should land first so the refactor doesn't lose institutional knowledge. Phase 3.9 (typing fixes) is worth doing first too so the type system catches mistakes during the split.

### 5.1 Split `canvasSlice.ts` into domain slices — XL, High
**Highest impact:** every consumer touches this file. Suggested seams (with current line ranges):
- `elementsSlice` — element CRUD, group/wrap/ungroup, breakpoint/state resets (L385-488).
- `selectionSlice` — selectedElementIds, editingElementId, setTool, selectElement (L154-161, L380-384).
- `documentSlice` — activePage, activeComponent, loadPage, loadComponent, reloadElements, pageSource, componentTrees (L163-195, L489-520).
- `uiSlice` — bottomPanel, leftSidebarTab, panelMode, userZoom, openThemePanel (L197-215, L520-589).
- `designSystemSlice` — breakpoints, states, theme tokens (L219-245, L267-283, L523-528, L590).
- `projectSlice` — projectFormat, projectPath, pageNames, requestPageNavigation (L275-305).
- Move `selectProjectColors` (L2189) to `@lib/projectColors.ts`.

**Action:** Use Zustand's `combine()` to keep `useCanvasStore` public API stable. Refactor in one big PR if possible to avoid intermediate broken states; if too large, do it under a feature flag.

**Acceptance:** No file in `@store/` >800 lines. All existing `useCanvasStore(selector)` callsites continue to work without changes. Full test suite passes.

### 5.2 Split `ProjectShell.tsx` — XL, High
Extract sub-components + hooks:
- `<PageSidebar>` (handlers `ProjectShell.tsx:852-950`).
- `<ComponentSidebar>` (`ProjectShell.tsx:1084-1507`).
- `<ProjectHeader>` (`ProjectShell.tsx:1540-1592`).
- `useProjectConfig` hook (config read/write + breakpoint mirroring).
- `useFontLinkReconciler` (`ProjectShell.tsx:333+`).
- `useComponentTreeCache` (`ProjectShell.tsx:218-251`).
- `useNavigationRequests` (`ProjectShell.tsx:269-303`).
- `useActiveTarget` + `openComponent`/`exitComponentEditor`/`persistActiveSource` (`ProjectShell.tsx:984-1076`).
- `useConvertToComponentEvent`, `useLockPropEvent`, `useDetachInstanceEvent`.

**Action:** Iterative — extract one hook/component per PR. Order from leaf to root.

**Acceptance:** `ProjectShell.tsx` is a layout component <500 lines composing the extracted pieces. Each extracted hook/component is independently testable.

### 5.3 Split `CanvasInteractionLayer.tsx` — L, Medium
4 mutually exclusive pointer state machines colocated. Split into per-tool hooks: `useDrawInteraction`, `useMoveInteraction`, `useResizeInteraction`, `useReorderInteraction`, plus `useDropInsert`. Hit-test utilities (`hitTest`, `propTextHitTest`, `isResizeHandle`) into `canvasHitTest.ts`.

**Acceptance:** Layer component dispatches to hooks based on `activeTool`. Each hook <250 lines.

### 5.4 Split `syncBridge.ts` into a folder — L, Medium
- `syncBridge/pendingSaves.ts` (L165-267)
- `syncBridge/writeDispatch.ts` (L270-339)
- `syncBridge/externalEdit.ts` (chokidar branch L694-794)
- `syncBridge/themeListener.ts`
- `syncBridge/index.ts` (`initSyncBridge` orchestration)

**Action:** Wait until Phase 1.3 (`docs/notes/save-status-machine.md`) is written.

**Acceptance:** No file in `syncBridge/` >400 lines. Round-trip integration tests still pass.

### 5.5 Audit and complete `HistoryActionKind` coverage — M, Medium
Per Phase 1.5's history-coverage doc: identify mutations that should push but don't.

**Likely candidates:**
- `set-prop-override` (instance prop edits)
- `rename-component`
- `delete-component`
- Theme-token edits
- Custom CSS / media-block edits

**Action:** For each, decide push-or-not, add the appropriate `HistoryActionKind`, and wire `commitElementsToHistory` calls.

**Acceptance:** A user can change a prop override on an instance, navigate away, come back, hit Cmd+Z, and the change rolls back.

---

**Phase 5 total estimate:** ~2-3 weeks. The two XL refactors are the long pole; the rest is manageable in <1 week each.

---

## Suggested rollout schedule

| Week | Focus |
|---|---|
| 1 | Phase 1 (quick wins + docs) |
| 2 | Phase 2 (security hardening) — can parallel with Phase 1 |
| 3 | Phase 3 (consolidation) |
| 4 | Phase 4.1-4.3 (low-risk lib splits) |
| 5 | Phase 4.4-4.7 (remaining splits) |
| 6-8 | Phase 5.1 (canvasSlice split) |
| 9-11 | Phase 5.2 (ProjectShell split) |
| 12 | Phase 5.3-5.5 (canvas layer, sync bridge, history audit) |

**Total: ~12 weeks of part-time work**, or ~6 weeks if it's the only thing on the table. Phases 1-3 alone (~2 weeks) account for most of the day-to-day quality of life improvement; Phases 4-5 are the long-term architectural payoff.

---

## What's not in this plan

- **Feature work.** Anything from `docs/backlog-*.md` is out of scope here.
- **Test-coverage expansion** beyond what each refactor mandates. CLAUDE.md already requires `@lib/` coverage; Phase 4 will fill gaps in `elementToStyle` etc. Beyond that, a separate test-coverage audit is its own project.
- **Performance work.** No perf issues surfaced in the review. If profiling later reveals hotspots, that's a separate plan.
- **Bundle-size optimization.** The build is ~2.5MB; not flagged as a concern. If it becomes one, treat as separate work.

---

## Resolved decisions

_Reviewed 2026-06-05. Each open question was checked against the code; conclusions below._

1. **Phase 2.7 (sandbox: true): release branch + manual test pass, no feature flag.** Both preloads (`src/preload/index.ts`, `src/preload/preview.ts`) are pure `contextBridge` + `ipcRenderer` bridges with zero direct Node usage — all Node work (terminal/node-pty, file IO, watcher) is already in main. That's the configuration where `sandbox: true` is a near-no-op, so the one-line flip in `src/main/index.ts:94` and `src/main/previewWindow.ts:126` doesn't warrant a flag. Watch one thing during the manual pass: the sandboxed preload must stay CommonJS-compatible (only imports `electron` + a type-only `@shared` import today, so it's fine).

2. **Phase 5.1 (canvasSlice split): one PR with `combine()`, NOT coexistence.** Today the store is a single monolithic `create<CanvasState>()((set) => ({...}))` (`canvasSlice.ts:912`, ~2200 lines, 44 consumers) — not yet using `combine()`. Coexisting old+new slices would create two sources of truth for element/selection state and require sync glue (worse than the split). `combine()` preserves the `useCanvasStore(selector)` public API, so consumer blast radius is zero if selectors stay stable. De-risk inside the branch: commit 1 mechanically extracts each domain into its own slice-creator module (pure move, shape unchanged); commit 2 wires them with `combine()`.

3. **Phase 5.2 (ProjectShell split): incremental, no feature freeze.** §5.2 already specifies leaf-to-root, one hook/component per PR — done that way each PR is small and the merge-conflict warning only applies to a big-bang approach. Sequence the self-contained leaf extractions first (`useFontLinkReconciler`, `useComponentTreeCache`, `useNavigationRequests`); save the big handler blocks (`<PageSidebar>` 852-950, `<ComponentSidebar>` 1084-1507) for a quiet window or right after in-flight branches merge.

4. **`generateCodeLegacy`: DELETE it and its test.** The only references are its own definition (`generateCode.ts:1389`), its build shims, and its dedicated test (`generateCodeImportName.test.ts`) — no app/main/renderer callsite imports it. It's a one-line wrapper kept alive only by a test for behaviour nothing depends on. The legacy *project format* still exists but is not wired to this function (its codegen path passes `cssModuleImportName` explicitly). Removing it shrinks Phase 4.5 scope — no `generateCode/legacy.ts` needed.

5. **`agent.md` overwrite: ADD an opt-out via `scamp.config.json`.** `refreshManagedFile` (`projectScaffold.ts:359`) overwrites `agent.md` + `CLAUDE.md` on every open when content differs from the shipped template — silently clobbering user hand-edits to a file presented as user-facing agent instructions. The `ProjectConfig` parser (`src/shared/projectConfig.ts`) already has the exact pattern to reuse (present-when-true boolean flags like `nextjsMigrationDismissed`). Add `agentMdManaged?: boolean`; when explicitly `false`, skip the `agent.md` refresh (keep `CLAUDE.md` managed — it's the loader stub). ~10 lines following an existing pattern.

**Cross-phase ordering note:** Phase 3.4 (`patchCustomProperties` action) and 3.9 (the `Record<string,unknown>` cast fixes) both touch `canvasSlice.ts`, which Phase 5.1 splits. The plan already orders 3.x before 5.1 — keep it that way so that work isn't written twice across the split.
