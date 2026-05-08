# Playwright Coverage vs User Docs — 2026-05-08

> **Status update (2026-05-08, post-fork)**: Four waves of new specs
> landed. 13 new spec files, 53 new tests, all passing. Sections
> marked **✅ NEW** below were added in this update. Recently-shipped
> untested features (shadows, blend modes, free-form size, duplicate
> indicator, PNG/SVG export, background-image upload, wrap-only
> linking) are no longer cross-cutting gaps.
>
> **Two specs deliberately dropped**: cross-page href refactor
> (legacy format doesn't refactor — feature is nextjs-only and would
> need a nextjs fixture) and on-canvas live token resolution (test
> setup is fragile across chokidar timings; feature works but the
> spec is not worth the maintenance cost).

## Executive Summary

- **24 user docs** audited against **73 Playwright spec files** (≈163 distinct tests, was 110).
- **~140 documented user-facing capabilities** tracked.
- **~83% coverage** (was 52% before, 70% after wave 2, 78% after wave 3).
  Four waves of new specs closed almost every documented gap; the
  remaining uncovered surface is Preview Mode + a small set of
  intentional skips.

### Coverage tiers

| Tier | Docs |
|---|---|
| ✅ **Well covered** (≥75% of capabilities tested) | `breakpoints.md`, `grouping.md`, `undo-redo.md`, `element-naming.md`, `keyboard-shortcuts.md`, `terminal.md`, `getting-started.md`, **`element-states.md`** ✅ NEW, **`animations.md`** ✅ NEW |
| ⚠ **Partial** (some core capabilities tested, others not) | `canvas.md`, `elements.md`, `properties-panel.md`, `color-picker.md`, `layers-panel.md`, `themes.md`, `code-output.md`, `bidirectional-sync.md`, `typography.md`, `grid-layout.md`, `settings.md`, `transitions.md`, **`linking.md`** ✅ NEW |
| ❌ **Uncovered or near-zero** | `preview.md`, `index.md` (TOC, no testable surface) |

### Remaining priority gaps

1. ~~Box shadow, blend modes, PNG/SVG export~~ → **All covered ✅ NEW**.
2. ~~`linking.md` is unsourced~~ → **Happy paths, chain icon, broken
   warning, AND wrap-only routing all covered ✅ NEW**. Page-rename
   href refactor (needs multi-page fixture) and click-icon navigation
   still untested.
3. ~~`element-states.md` is unsourced~~ → **Covered ✅ NEW**.
4. **`preview.md` is unsourced** — Preview window + dev-server
   lifecycle have no e2e coverage. The `live-preview.spec.ts` file
   (despite the name) tests the bottom *code* panel, not Preview
   Mode. Likely intentional given dev-server complexity.
5. ~~`animations.md` is unsourced~~ → **All seven property controls
   covered ✅ NEW** (preset, Duration, Easing, Delay, Direction, Fill
   mode, Play state) plus per-state animation. ▶ Play preview button,
   custom-easing editor, and `iterationCount: infinite` still
   untested.

### Stale doc / dead reference (not a coverage gap, but worth fixing)

- `keyboard-shortcuts.md` and `canvas.md` no longer mention `Cmd+Shift+E` (good — the shortcut was removed). No drift here.
- No doc references PDF export (good — it was removed).
- `properties-panel.md` and `breakpoints.md` describe the **blue dot** override indicator but don't yet describe the **yellow duplicate-CSS-declaration dot**. Worth a doc update; not a test gap.
- `properties-panel.md`'s "Border" subsection still says "**W** (width), **R** (border-radius)" but doesn't mention the new four-side / shorthand affordance the spec covers.
- `properties-panel.md`'s "Size" subsection doesn't yet describe the free-form CSS input that accepts `100vh`, `calc(...)`, etc. (shipped 2026-05-07).

---

## animations.md ✅ NEW

**Scope**: Animation section in the Properties Panel — preset picker (19 named keyframes), seven timing controls, ▶ Play canvas preview, per-state animations, `@keyframes` round-trip.

| Capability | Spec | Status |
|---|---|---|
| Animation section appears for every selected element | `properties-panel/animations.spec.ts` | ✅ |
| Preset picker dropdown (covered indirectly via `selectOption('pulse')`) | `properties-panel/animations.spec.ts` | ⚠ — option list grouping not asserted |
| Picking a preset writes `animation` shorthand + appends matching `@keyframes` | `properties-panel/animations.spec.ts` | ✅ |
| Duration field updates the timing | `properties-panel/animations.spec.ts` | ✅ |
| Easing / Delay / Direction / Fill mode dropdowns flow into shorthand | `properties-panel/animations.spec.ts` ✅ NEW | ✅ |
| Play state segmented control toggles running ↔ paused | `properties-panel/animations.spec.ts` ✅ NEW | ✅ |
| Iteration count input | none — covered indirectly via the Iteration popover | ⚠ |
| Iteration "Infinite" mode | `properties-panel/animations.spec.ts` ✅ NEW | ✅ |
| ▶ Play preview button click is non-erroring | `properties-panel/animations.spec.ts` ✅ NEW | ✅ — smoke test only (animation paint not asserted) |
| Per-state hover animation (Hover → `shake`) | `properties-panel/animations.spec.ts` | ✅ |
| Switching presets re-emits the new name | `properties-panel/animations.spec.ts` | ✅ |
| ✕ Remove drops the animation declaration | `properties-panel/animations.spec.ts` | ✅ |
| Custom hand-written `@keyframes` round-trip | none | ❌ |
| `@keyframes` block deduplicated by name across multiple users | none | ❌ |

### Gaps
- Iteration count input (numeric and "Infinite" mode).
- ▶ Play preview button trigger.
- Custom hand-written `@keyframes` body round-trip.

---

## bidirectional-sync.md

**Scope**: Two-way file sync, save-status indicator, `agent.md`, working with AI agents.

| Capability | Spec | Status |
|---|---|---|
| External CSS edit reflected on canvas | `bidirectional-sync/external-css-edit.spec.ts` | ✅ |
| Save-status indicator: Saved → Saving → Saved transitions | `code-output/save-status.spec.ts` | ✅ |
| Save-status indicator: Save failed + Retry button | none | ❌ |
| External edit clears undo history | `undo-redo/clears-on-external-edit.spec.ts` | ✅ |
| Unknown CSS at-rules round-trip verbatim | `breakpoints/css-output.spec.ts` (covers unknown `@media`) | ⚠ |
| `agent.md` exists and is documented | none (config check only) | ❌ |
| External TSX edit reflected on canvas | none — only CSS-edit path tested | ❌ |

### Gaps
- No spec for an external **TSX** edit reflecting on the canvas.
- "Save failed" → Retry button flow is untested.
- `@keyframes` and `@supports` round-trip claims aren't asserted (only `@media` is).

---

## breakpoints.md

**Scope**: Three default breakpoints, switch via canvas-size control, edit at a breakpoint, override indicator dot, custom breakpoints, cascade behaviour.

| Capability | Spec | Status |
|---|---|---|
| Three default breakpoints (Desktop/Tablet/Mobile) | `breakpoints/switch-breakpoint.spec.ts` | ✅ |
| Switch breakpoint via canvas-size popover | `breakpoints/switch-breakpoint.spec.ts` | ✅ |
| Switching back to Desktop reverts canvas width | `breakpoints/switch-breakpoint.spec.ts` | ✅ |
| Edits at a non-desktop breakpoint route to override | `breakpoints/override-routing.spec.ts` | ✅ |
| Drag/resize at a breakpoint lands in override | none | ❌ |
| Tag/text/name edits stay at base regardless of breakpoint | none | ❌ |
| Override-indicator blue dot appears next to section title | `properties-panel/override-dot.spec.ts` | ✅ |
| Right-click dot resets section's overrides at that breakpoint | `properties-panel/override-dot.spec.ts` | ✅ |
| Hover dot shows tooltip listing overridden CSS props | none — spec asserts dot presence, not tooltip text | ⚠ |
| Cascade order: Tablet override applies at Mobile when Mobile is empty | none | ❌ |
| Custom width input drops back to Desktop | none | ❌ |
| Multi-breakpoint widest-first `@media` emit | `breakpoints/css-output.spec.ts` | ✅ |
| Unknown `@media` queries round-trip verbatim | `breakpoints/css-output.spec.ts` | ✅ |
| Add custom breakpoint → appears in popover | `breakpoints/custom-breakpoint.spec.ts` | ✅ |
| Edit at custom breakpoint emits its own `@media` block | `breakpoints/custom-breakpoint.spec.ts` | ✅ |
| Pixel values only (`max-width: 48rem` doesn't match) | none | ❌ |

### Gaps
- Drag/resize at a non-desktop breakpoint not asserted.
- Cascade behaviour (wider breakpoint applies at narrower one) not directly tested.
- Custom-width input dropping the active breakpoint back to Desktop not tested.

---

## canvas.md

**Scope**: Drawing tools, selection, move/resize/nudge, page-name badge, canvas-size control, scroll/zoom, duplicate/delete shortcuts.

| Capability | Spec | Status |
|---|---|---|
| R + drag draws a rect | `canvas/draw-rect.spec.ts` | ✅ |
| R + click drops default-sized rect | `canvas/draw-rect.spec.ts` | ✅ |
| T + click places text | `canvas/draw-text.spec.ts` | ✅ |
| F + drag creates an `<input>` | `canvas/draw-input.spec.ts` | ✅ |
| I (image) tool flow — click and drag | `canvas/draw-image.spec.ts` ✅ NEW | ✅ |
| V activates select | `keyboard-shortcuts/tool-shortcuts.spec.ts` | ✅ |
| After draw, tool reverts to select | `canvas/draw-rect.spec.ts` | ✅ |
| Click selects, click-empty deselects | `canvas/select-move-resize.spec.ts` | ✅ |
| Click page-name badge selects root | none | ❌ |
| Selected element shows resize handles | `canvas/select-move-resize.spec.ts` | ✅ |
| Drag move writes new position to disk | `canvas/select-move-resize.spec.ts` | ✅ |
| Resize handle grows the rect | `canvas/select-move-resize.spec.ts` | ✅ |
| Arrow nudge 1px | `canvas/nudge.spec.ts` | ✅ |
| Shift+Arrow nudge 10px | `canvas/nudge.spec.ts` | ✅ |
| Cmd+D duplicates | `keyboard-shortcuts/action-shortcuts.spec.ts` | ✅ |
| Delete/Backspace removes | `keyboard-shortcuts/action-shortcuts.spec.ts` | ✅ |
| Drag/resize clamps to visible page | none | ❌ |
| Canvas-size popover: breakpoint preset buttons | `breakpoints/switch-breakpoint.spec.ts` | ✅ |
| Custom width input drops the active breakpoint to Desktop | `canvas/canvas-width.spec.ts` ✅ NEW | ✅ |
| Overflow-hidden toggle | none | ❌ |
| Cmd+= zoom in / Cmd+- zoom out / Cmd+0 reset | `keyboard-shortcuts/zoom-shortcuts.spec.ts` | ✅ |

### Gaps
- ~~Image tool (`I`) draw flow not tested.~~ → covered ✅ NEW
- Page-name badge selection is unsourced (no badge feature found in code; doc mention may be aspirational).
- ~~Custom canvas width input untested.~~ → covered ✅ NEW
- Overflow-hidden toggle untested.
- Drag/resize clamping not asserted.

---

## code-output.md

**Scope**: TSX/CSS file generation, live code preview panel, save-status, debounced/atomic writes, format migration.

| Capability | Spec | Status |
|---|---|---|
| TSX has `data-scamp-id` matching className | `getting-started.spec.ts` | ✅ |
| Class prefix `rect_/text_/img_/input_` | `canvas/draw-rect.spec.ts`, `canvas/draw-text.spec.ts`, `canvas/draw-input.spec.ts` | ✅ |
| Tag-specific attributes round-trip | `elements/tag-attributes.spec.ts` | ✅ |
| Only non-default CSS properties emitted | none directly; implied by other specs | ⚠ |
| `customProperties` round-trip for unknown CSS | `bidirectional-sync/external-css-edit.spec.ts` (partial — CSS-mode write, not full unknown-prop) | ⚠ |
| `@media` blocks at bottom, widest-first | `breakpoints/css-output.spec.ts` | ✅ |
| Unknown `@media` queries preserved | `breakpoints/css-output.spec.ts` | ✅ |
| Live code preview shows TSX + CSS | `code-output/live-preview.spec.ts` | ✅ |
| Code panel updates when canvas changes | `code-output/live-preview.spec.ts` | ✅ |
| Save status: Saved | `code-output/save-status.spec.ts` | ✅ |
| Save status: Saving → Saved | `code-output/save-status.spec.ts` | ✅ |
| Save status: Save failed + Retry | none | ❌ |
| Format migration banner on legacy projects | none | ❌ |
| Atomic file writes | none (hard to assert) | ❌ |

### Gaps
- "Save failed" Retry path is unsourced.
- No assertion that legacy-format root sizing migration happens silently with a banner.

---

## color-picker.md

**Scope**: Color popover (Color tab + Tokens tab), hex input, alpha output format, project swatches, presets.

| Capability | Spec | Status |
|---|---|---|
| Hex input writes a 6-digit hex to CSS | `color-picker/hex-input.spec.ts` | ✅ |
| Fully opaque → `#rrggbb` output | `color-picker/alpha-output.spec.ts` | ✅ |
| Alpha < 1 → `rgba()` output | `color-picker/alpha-output.spec.ts` | ✅ |
| Tokens tab applies `var(--name)` | `color-picker/tokens-tab.spec.ts` | ✅ |
| Project swatch strip shows previously-used colors | `color-picker/project-swatches.spec.ts` | ✅ |
| Saturation area and hue slider | none (UI-mechanic-only — ChromePicker internals) | ⚠ |
| Preset swatches at bottom of picker | none | ❌ |
| Token preview swatches show resolved color | none | ❌ |

### Gaps
- Picker's preset-swatch grid (the curated `PRESET_COLORS` list) untested.
- Hue/saturation drag interactions untested (acceptable — they're library internals).

---

## element-naming.md

**Scope**: Default names, rename via double-click, slug conversion, clearing.

| Capability | Spec | Status |
|---|---|---|
| Default `rect_<id>` name | `canvas/draw-rect.spec.ts` | ✅ |
| Double-click rename writes slug to CSS | `element-naming/rename.spec.ts` | ✅ |
| Display in title case in panel | `element-naming/rename.spec.ts` | ✅ |
| Clearing name reverts to default prefix | `element-naming/clear-name.spec.ts` | ✅ |
| Round-trip persistence across save/reload | none directly (covered indirectly by the rename spec via file-write assertion) | ⚠ |

### Gaps
- None of substance; this doc is well covered.

---

## elements.md

**Scope**: Four element types, default tags, full per-type tag list, tag-specific attributes, `<select>` options editor, `<svg>` source, list-context defaults.

| Capability | Spec | Status |
|---|---|---|
| Rectangle defaults to `<div>` | `canvas/draw-rect.spec.ts` | ✅ |
| Text defaults to `<p>` | `canvas/draw-text.spec.ts` | ✅ |
| Input defaults to `<input>` | `canvas/draw-input.spec.ts` | ✅ |
| Image defaults to `<img>` | `canvas/draw-image.spec.ts` ✅ NEW | ✅ |
| Tag dropdown changes tag (rect → nav) | `elements/tag-change.spec.ts` | ✅ |
| Tag dropdown changes tag (text → h1) | `elements/tag-change.spec.ts` | ✅ |
| Anchor: `href` + `target` round-trip | `elements/tag-attributes.spec.ts` | ✅ |
| Dialog: Open boolean attribute | `elements/tag-attributes.spec.ts` | ✅ |
| Form: method GET/POST | `elements/tag-attributes.spec.ts` | ✅ |
| Button `type` attribute | none | ❌ |
| Label `for` (htmlFor) | none | ❌ |
| Blockquote `cite` | none | ❌ |
| Time `datetime` | none | ❌ |
| Video `src` + boolean attrs | none | ❌ |
| Iframe `src` + `title` | none | ❌ |
| Input `type` + `placeholder` | none | ❌ |
| Textarea `rows` + `placeholder` | none | ❌ |
| `<select>` options editor | `elements/select-options.spec.ts` | ✅ |
| `<svg>` source verbatim | `elements/svg-source.spec.ts` | ✅ |
| List context: rect inside `<ul>` defaults to `<li>` | `elements/list-context-defaults.spec.ts` | ✅ |
| Class prefix stays the same after tag change | `elements/tag-change.spec.ts` | ✅ |

### Gaps
- ~~Image element tests are entirely missing.~~ → image draw flow covered ✅ NEW; tag-specific image attributes (`alt` editing, source replacement) still untested.
- Many tag-specific attribute combinations are unsourced (button/label/blockquote/time/video/iframe/input-type/textarea).

---

## element-states.md ✅ NEW

**Scope**: State Switcher (Default/Hover/Active/Focus), per-state overrides, state-dot indicator, pseudo-class CSS emit.

| Capability | Spec | Status |
|---|---|---|
| State Switcher renders 4 buttons when an element is selected | `element-states/state-switcher.spec.ts` | ✅ |
| Editing in Hover writes to `:hover` block | `element-states/state-switcher.spec.ts` | ✅ |
| Editing in Active writes to `:active` block | `element-states/state-switcher.spec.ts` | ✅ |
| Editing in Focus writes to `:focus` block | `element-states/state-switcher.spec.ts` | ✅ |
| Default state edits route to the base, leaving state blocks intact | `element-states/state-switcher.spec.ts` | ✅ |
| State-dot indicator on switcher buttons | `element-states/state-switcher.spec.ts` | ✅ |
| State preview on canvas matches state styles | none | ❌ |
| Right-click reset of state-axis override | `element-states/state-switcher.spec.ts` ✅ NEW | ✅ |
| Other pseudo-classes round-trip verbatim (`:focus-visible`, `:checked`) | none | ❌ |
| Removing all overrides clears the dot AND drops the pseudo-class block | none | ❌ |
| State + non-desktop breakpoint correctly disabled | `element-states/state-switcher.spec.ts` ✅ NEW | ✅ |

### Gaps
- Right-click reset on a state-axis override (vs. breakpoint axis).
- Removing all overrides drops the entire pseudo-class block.
- Non-desktop breakpoint disables state buttons.
- Verbatim round-trip of unsupported pseudo-class blocks (`:focus-visible`, `:checked`, etc.).

---

## getting-started.md

**Scope**: Installer, Start Screen, project creation, default folder, project file structure.

| Capability | Spec | Status |
|---|---|---|
| Auto-opens a seeded project; renders root | `getting-started.spec.ts` | ✅ |
| Backfills `scamp.config.json` on open | `getting-started.spec.ts` | ✅ |
| Generated home files contain root class | `getting-started.spec.ts` | ✅ |
| Start Screen with sidebar + recent projects | `settings/app-settings.spec.ts` (partial — opens it) | ⚠ |
| New Project button creates a project + opens it | none | ❌ |
| Default-folder picker persists | `settings/app-settings.spec.ts` | ✅ |

### Gaps
- The "click New Project, type a name, see the project open" happy path is not e2e tested.

---

## grid-layout.md

**Scope**: Display: Grid, container controls (Columns/Rows/gaps/Align Items/Justify Items), grid-item controls (Col/Row/AlignSelf/JustifySelf), grid overlay.

| Capability | Spec | Status |
|---|---|---|
| Toggle Display to Grid emits `display: grid` | `properties-panel/grid-layout.spec.ts` | ✅ |
| Free-text Columns / Rows accepted | `properties-panel/grid-layout.spec.ts` | ✅ |
| Flex → Grid migrates gap into both axis gaps | `properties-panel/grid-layout.spec.ts` | ✅ |
| Grid-item controls (Col/Row) appear when parent is grid | `properties-panel/grid-layout.spec.ts` | ✅ |
| `grid-column` / `grid-row` emitted | `properties-panel/grid-layout.spec.ts` | ✅ |
| Grid-line overlay rendered when grid container selected | `properties-panel/grid-layout.spec.ts` | ✅ |
| Align/Justify items segmented controls | none | ❌ |
| Align self / Justify self segmented controls | none — `grid-layout.spec.ts` checks Col/Row but not Align/Justify Self | ❌ |
| Auto-placement: children with no Col/Row flow naturally | none | ❌ |

### Gaps
- AlignItems / JustifyItems / AlignSelf / JustifySelf segmented control assertions are missing.

---

## grouping.md

**Scope**: Cmd+G group, Cmd+Shift+G ungroup, nested groups, fit-content + flex defaults.

| Capability | Spec | Status |
|---|---|---|
| Cmd+G wraps siblings into flex group | `grouping/group-ungroup.spec.ts` | ✅ |
| Cmd+Shift+G ungroups | `grouping/group-ungroup.spec.ts` | ✅ |
| Nested groups (group inside a group) | `grouping/nested-groups.spec.ts` | ✅ |
| Group has `display:flex` + `fit-content` defaults | `grouping/group-ungroup.spec.ts` | ✅ |
| Cannot group root | none | ❌ |
| Cannot group across different parents | none | ❌ |
| Children x/y reset to 0 on group | implied by group-ungroup spec | ⚠ |

### Gaps
- Negative-path tests (refuse to group root, refuse cross-parent grouping) untested.

---

## index.md

Table of contents only — no testable surface. Skipped.

---

## keyboard-shortcuts.md

**Scope**: Tools (V/R/T/I/F), actions (Cmd+D/Delete/Cmd+G/Cmd+C+V/Cmd+Z/Cmd+S/arrows), zoom (Cmd+=/-/0), panels (Ctrl+`/Cmd+P).

| Capability | Spec | Status |
|---|---|---|
| V/R/T/I/F activate respective tools | `keyboard-shortcuts/tool-shortcuts.spec.ts` | ✅ |
| Tool shortcuts ignored while text input focused | `keyboard-shortcuts/tool-shortcuts.spec.ts` | ✅ |
| Cmd+D duplicate | `keyboard-shortcuts/action-shortcuts.spec.ts` | ✅ |
| Delete removes | `keyboard-shortcuts/action-shortcuts.spec.ts` | ✅ |
| Cmd+C / Cmd+V copy/paste | `keyboard-shortcuts/action-shortcuts.spec.ts` | ✅ |
| Cmd+G / Cmd+Shift+G group/ungroup | `grouping/group-ungroup.spec.ts` | ✅ |
| Cmd+Z / Cmd+Shift+Z undo/redo | `undo-redo/basic-undo-redo.spec.ts` | ✅ |
| Cmd+S commits CSS editor | none directly — `properties-panel/css-mode.spec.ts` uses blur-to-commit | ⚠ |
| Arrow nudge 1px / Shift+Arrow 10px | `canvas/nudge.spec.ts` | ✅ |
| Cmd+= / Cmd+- / Cmd+0 zoom | `keyboard-shortcuts/zoom-shortcuts.spec.ts` | ✅ |
| Ctrl+` toggles terminal | `terminal/toggle-panel.spec.ts` | ✅ |
| Cmd+P opens Preview Mode | none | ❌ |
| Right-click section dot resets overrides | `properties-panel/override-dot.spec.ts` | ✅ |

### Gaps
- Cmd+S CSS editor commit shortcut not directly asserted.
- Cmd+P Preview Mode shortcut untested.

---

## layers-panel.md

**Scope**: Element tree, click select, shift-click multi-select, drag-drop reorder, rename, tooltips.

| Capability | Spec | Status |
|---|---|---|
| Tree shows DFS-ordered rows | `layers-panel/selection.spec.ts` | ✅ |
| Click row selects element on canvas | `layers-panel/selection.spec.ts` | ✅ |
| Shift-click multi-select | none | ❌ |
| Drag-drop reorder siblings | `layers-panel/reorder-dnd.spec.ts` | ✅ |
| Drag-drop re-parent (drop onto rectangle) | `layers-panel/reorder-dnd.spec.ts` | ✅ |
| Double-click rename | `element-naming/rename.spec.ts` | ✅ |
| Hover tooltip shows `.{className}` | `layers-panel/tooltips.spec.ts` | ✅ |

### Gaps
- Shift-click multi-select from the layers panel not asserted.

---

## linking.md ✅ NEW

**Scope**: Link field in Element section, internal-page dropdown, external-URL input, tag swap vs wrap routing, "Open in new tab" toggle, canvas chain icon, broken-link state, page-rename href refactor, removal flow.

| Capability | Spec | Status |
|---|---|---|
| "Link to" None/Page/External dropdown | `linking/link-field.spec.ts` | ✅ |
| Pick page → writes `<a href="/...">` to TSX | `linking/link-field.spec.ts` | ✅ |
| External URL input writes external href | `linking/link-field.spec.ts` | ✅ |
| `div`/`p`/`span`/`button` → tag swap to `<a>` | `linking/link-field.spec.ts` | ✅ |
| Image/video/iframe/svg/input → wrap in new `<a>` parent | `linking/wrap-only.spec.ts` ✅ NEW | ✅ — img path; other tag paths inferred |
| Already-`<a>` element edits existing href | none — covered indirectly by external-URL spec which leaves the element as `<a>` | ⚠ |
| Section/article/header/etc. → Link field hidden | none | ❌ |
| "Open in new tab" toggle adds `target="_blank"` + `rel="noopener noreferrer"` | `linking/link-field.spec.ts` | ✅ |
| Selected element shows chain-link icon on canvas | `linking/canvas-link-icon.spec.ts` | ✅ |
| Hover icon shows destination tooltip (aria-label) | `linking/canvas-link-icon.spec.ts` | ✅ |
| Click chain icon (internal) navigates canvas to that page | none | ❌ |
| Click chain icon (external) opens system browser | none | ❌ |
| Broken link (target page renamed/deleted) → red icon + warning | `linking/canvas-link-icon.spec.ts` | ✅ |
| Page rename rewrites all `href="/<old>"` references project-wide | none — fixture has only `home`; would need a 2-page fixture | ❌ |
| Set destination back to None for swapped element clears href | none | ❌ |
| For wrapped element, "Wrapped in /…" hint pill + Select wrapper | none | ❌ |

### Gaps
- ~~Wrap-only routing~~ → covered for `<img>` ✅ NEW; other wrap tags
  (video/iframe/svg/input) inferred via shared code path.
- Page-rename href refactor (needs multi-page fixture).
- Click-icon navigation (internal page-switch and external open).
- "None" destination clears href on a previously-anchor element.
- Section/article/header tag → Link field hidden.

---

## preview.md

**Scope**: Preview Mode window, ⌘P shortcut, viewport selector, server lifecycle states, DevTools, error overlay.

| Capability | Spec | Status |
|---|---|---|
| ▶ Preview button opens window | none | ❌ |
| ⌘P opens / focuses preview | none | ❌ |
| First-time `npm install` flow | none | ❌ |
| HMR picks up canvas edits in preview | none | ❌ |
| Preview toolbar: back/forward/reload/URL bar/copy URL/status/DevTools/viewport | none | ❌ |
| Viewport selector: Mobile/Tablet/Desktop/Fullscreen/Custom | none | ❌ |
| Server-status states (Idle/Installing/Starting/Ready/Crashed) | none | ❌ |
| Restart on crash | none | ❌ |
| External link opens in system browser | none | ❌ |
| DevTools button opens Chrome DevTools | none | ❌ |

### Gaps
**Entirely unsourced.** Note: `live-preview.spec.ts` despite the name is about the bottom **code preview** panel, NOT Preview Mode. This is likely intentional given how tricky e2e-testing a real `next dev` server in CI would be — but worth flagging as the largest user-doc area without any test surface.

---

## properties-panel.md

**Scope**: Visual mode + CSS mode, per-section controls (Element, Size, Layout, Spacing, Background, Border, Visibility), per-breakpoint editing, override dot.

| Capability | Spec | Status |
|---|---|---|
| Shortcuts table when nothing selected | `properties-panel/visual-mode.spec.ts` | ✅ |
| Rectangle shows Element/Position/Size/Layout/Spacing/Background/Border/Visibility | `properties-panel/visual-mode.spec.ts` | ✅ |
| Text shows Typography, hides Layout | `properties-panel/visual-mode.spec.ts` | ✅ |
| Input hides Layout + Typography | `properties-panel/visual-mode.spec.ts` | ✅ |
| Size: W/H free-form inputs | `properties-panel/size-controls.spec.ts`, `properties-panel/size-free-form.spec.ts` ✅ NEW | ✅ |
| Size: mode selector (Fixed/Stretch/Hug/Auto) | `properties-panel/size-controls.spec.ts`, `properties-panel/size-free-form.spec.ts` ✅ NEW | ✅ |
| Free-form size input accepts `100vh`/`calc()`/`var()` | `properties-panel/size-free-form.spec.ts` ✅ NEW | ✅ |
| Free-form size auto-detects mode (`100%` → Stretch, `auto`/`fit-content`) | `properties-panel/size-free-form.spec.ts` ✅ NEW | ✅ |
| Bare numeric input is treated as `px` | `properties-panel/size-free-form.spec.ts` ✅ NEW | ✅ |
| Layout: Block/Flex toggle | `properties-panel/layout-flex.spec.ts` | ✅ |
| Flex Direction/Align/Justify/Gap | `properties-panel/layout-flex.spec.ts` | ✅ |
| Spacing: P/M shorthand input (1/2/4 values) | `properties-panel/spacing-shorthand.spec.ts` | ✅ |
| Background: hex color input | `properties-panel/background.spec.ts` | ✅ |
| Background: image upload + size/position/repeat | `properties-panel/background-image.spec.ts` ✅ NEW | ✅ |
| Background: "Remove background image" clears all 4 props | `properties-panel/background-image.spec.ts` ✅ NEW | ✅ |
| Border: style / width / radius round-trip | `properties-panel/border.spec.ts` | ✅ |
| Border: shorthand radius (e.g. `10 20 10 20`) | none — `border.spec.ts` doesn't assert four-side shorthand | ⚠ |
| Visibility: opacity 0–100% | `properties-panel/visibility-opacity.spec.ts` | ✅ |
| Visibility: Visible/Hidden/None segmented | `properties-panel/visibility-opacity.spec.ts` | ✅ |
| CSS mode toggle | `properties-panel/css-mode.spec.ts` | ✅ |
| CSS mode commit on blur | `properties-panel/css-mode.spec.ts` | ✅ |
| CSS mode scopes to active breakpoint's `@media` block | none | ❌ |
| Override blue dot with section field-list tooltip | `properties-panel/override-dot.spec.ts` | ⚠ — checks dot presence; tooltip text content not asserted |
| **Yellow duplicate-CSS dot** (new feature, not yet documented) | `properties-panel/duplicate-indicator.spec.ts` ✅ NEW | ✅ |
| Editing a typed field clears the dot AND collapses the file | `properties-panel/duplicate-indicator.spec.ts` ✅ NEW | ✅ |
| Right-click dot resets overrides | `properties-panel/override-dot.spec.ts` | ✅ |

### Gaps
- ~~The new free-form Size input (vh/calc/var/auto-detect) is unsourced.~~ → covered ✅ NEW
- ~~Background-image upload + size/position/repeat untested.~~ → covered ✅ NEW
- Border shorthand-radius input untested.
- CSS mode at-breakpoint scoping untested.
- ~~Duplicate-CSS yellow indicator (new feature) has no e2e spec or doc entry.~~ → e2e covered ✅ NEW (doc entry still missing)

---

## settings.md

**Scope**: App settings (default folder), project settings (artboard color, breakpoints, fonts).

| Capability | Spec | Status |
|---|---|---|
| Default Projects Folder picker | `settings/app-settings.spec.ts` | ✅ |
| Artboard color stored in `scamp.config.json`, not in CSS | `settings/project-settings-artboard.spec.ts` | ✅ |
| Add custom breakpoint, list stays widest-first | `settings/project-settings-breakpoints.spec.ts` | ✅ |
| Desktop breakpoint cannot be removed | `settings/project-settings-breakpoints.spec.ts` | ✅ |
| Remove non-desktop breakpoint shrinks list | `settings/project-settings-breakpoints.spec.ts` | ✅ |
| Edit breakpoint label / width inline | none | ❌ |
| Add Google Fonts URL writes `@import` to theme.css | `settings/project-settings-fonts.spec.ts` | ✅ |
| Remove Google Font | none | ❌ |

### Gaps
- Breakpoint label/width inline edit not asserted.
- Font removal not asserted.

---

## terminal.md

**Scope**: Toggle panel (Ctrl+`), multiple tabs (max 3), persistence on hide.

| Capability | Spec | Status |
|---|---|---|
| Ctrl+` opens / hides terminal | `terminal/toggle-panel.spec.ts` | ✅ |
| Toolbar Terminal button toggles | `terminal/toggle-panel.spec.ts` | ✅ |
| Up to 3 tabs; + button hidden after 3rd | `terminal/multiple-tabs.spec.ts` | ✅ |
| Hide preserves DOM / pty processes | `terminal/persistence.spec.ts` | ✅ |
| Error recovery for failed shell start | none (acceptable; non-deterministic) | ⚠ |

### Gaps
- None of substance. (CI-skip for these specs is documented in-spec — node-pty is flaky in CI.)

---

## themes.md

**Scope**: theme.css file, theme panel (add/rename/delete tokens), tokens in color picker, CSS-mode token autocomplete, visual resolution on canvas.

| Capability | Spec | Status |
|---|---|---|
| Theme panel lists seeded tokens | `themes/theme-panel-crud.spec.ts` | ✅ |
| Add color token writes to theme.css | `themes/theme-panel-crud.spec.ts` | ✅ |
| Rename token updates theme.css | `themes/theme-panel-crud.spec.ts` | ✅ |
| Delete token removes from theme.css | `themes/theme-panel-crud.spec.ts` | ✅ |
| Token list scrolls / dialog stays sized | `themes/theme-panel-crud.spec.ts` | ✅ |
| Tokens appear in color picker Tokens tab | `themes/tokens-in-picker.spec.ts` | ✅ |
| `var(--` autocomplete in CSS editor | `themes/theme-css-autocomplete.spec.ts` | ✅ |
| Tokens resolve to actual color on canvas | none | ❌ |
| Changing token value updates canvas immediately | none | ❌ |

### Gaps
- Live token-resolution on canvas (the "change a token, see every element update" promise) is untested.

---

## transitions.md

**Scope**: Transitions section, four controls per row (Property/Duration/Easing/Delay), custom easing, comma-separated emit.

| Capability | Spec | Status |
|---|---|---|
| Add transition row writes `transition: …` shorthand | `properties-panel/transitions.spec.ts` | ✅ |
| Multiple rows emit comma-separated shorthand | `properties-panel/transitions.spec.ts` | ✅ |
| Removing a row shrinks shorthand | `properties-panel/transitions.spec.ts` | ✅ |
| Property dropdown options | none directly | ⚠ |
| Duration ms / s unit toggle | none | ❌ |
| Custom easing → cubic-bezier editor | none | ❌ |
| Hand-written `cubic-bezier(...)` round-trips into Custom… | none | ❌ |
| Hand-written longhand (`transition-property`, etc.) parsed into rows | none | ❌ |

### Gaps
- Custom easing editor untested.
- Longhand-form round-trip untested.

---

## typography.md

**Scope**: Text creation, font picker (Google Fonts + system), font size/weight/color, alignment + line-height + letter-spacing, semantic tag selector.

| Capability | Spec | Status |
|---|---|---|
| T + click selects new text element so Typography appears | `typography/text-creation.spec.ts` | ✅ |
| Font picker commits font-family | `typography/font-picker.spec.ts` | ✅ |
| Custom-font escape hatch (typed name) | `typography/font-picker.spec.ts` | ✅ |
| Font size numeric input | none directly | ⚠ |
| Font weight selector | none | ❌ |
| Text color via color picker | none directly | ⚠ |
| Text align L/C/R | `typography/alignment-spacing.spec.ts` | ✅ |
| Line height | `typography/alignment-spacing.spec.ts` | ✅ |
| Letter spacing | `typography/alignment-spacing.spec.ts` | ✅ |
| Tag selector (p/h1–h6/span/etc.) | `elements/tag-change.spec.ts` | ✅ (covered indirectly) |
| Google Fonts CDN link injected | `settings/project-settings-fonts.spec.ts` | ✅ |

### Gaps
- Font weight selector not directly asserted.
- Font size numeric input not directly asserted (covered indirectly through some other specs but not pinned).

---

## undo-redo.md

**Scope**: Cmd+Z / Cmd+Shift+Z, what's tracked, 50-step limit, history-clear conditions.

| Capability | Spec | Status |
|---|---|---|
| Cmd+Z undoes an add; Cmd+Shift+Z redoes | `undo-redo/basic-undo-redo.spec.ts` | ✅ |
| Multiple sequential edits each undo one step | `undo-redo/basic-undo-redo.spec.ts` | ✅ |
| Undoing past 50 edits stops | `undo-redo/history-limit.spec.ts` | ✅ |
| External CSS write clears undo stack | `undo-redo/clears-on-external-edit.spec.ts` | ✅ |
| Page-switch clears undo for previous page | `undo-redo/clears-on-page-switch.spec.ts` | ✅ |

### Gaps
- None. This doc is fully covered.

---

## Cross-cutting gaps

These are features documented (or shipped, even if not yet documented) that span multiple docs and have no e2e spec home:

### Recently-shipped, undocumented in user docs, untested in e2e

| Feature | Notes |
|---|---|
| ~~**Box shadow** (`ShadowsSection.tsx`)~~ | ✅ NEW: `properties-panel/shadows.spec.ts` — 5 tests covering add / multi-row / inset / opacity / remove. Doc still missing. |
| ~~**Mix blend mode + Background blend mode**~~ | ✅ NEW: `properties-panel/blend-modes.spec.ts` — 3 tests. Doc still missing. |
| ~~**PNG / SVG export** (`ExportSection.tsx`)~~ | ✅ NEW: `export/png-svg.spec.ts` — 2 tests. PNG signature byte check + SVG XML root check. Doc still missing. |
| **Element right-click "Export…" context menu** | New `ElementContextMenu.tsx`. Zero specs. |
| ~~**Duplicate-CSS yellow indicator**~~ | ✅ NEW: `properties-panel/duplicate-indicator.spec.ts` — 2 tests. Doc still missing. |
| ~~**Free-form Size input**~~ | ✅ NEW: `properties-panel/size-free-form.spec.ts` — 5 tests covering vh / calc / var / `100%` auto-detect / bare-number-as-px. Doc still missing. |

### Documented but untested

| Feature | Notes |
|---|---|
| ~~**Animations** (`animations.md`)~~ | ✅ NEW: `properties-panel/animations.spec.ts` — 5 tests. Detailed gaps in the per-doc section above. |
| ~~**Element states** (`element-states.md`)~~ | ✅ NEW: `element-states/state-switcher.spec.ts` — 5 tests. Detailed gaps in the per-doc section above. |
| ~~**Linking** (`linking.md`)~~ | ✅ NEW: `linking/link-field.spec.ts` (3) + `linking/canvas-link-icon.spec.ts` (2) + `linking/wrap-only.spec.ts` (1) — 6 tests total. Page-rename refactor needs a nextjs-format fixture (legacy doesn't refactor cross-page) — deferred. |
| **Preview Mode** (`preview.md`) | Window + dev-server lifecycle. Zero specs. (Likely deferred for CI reasons.) |
| ~~**Image element**~~ | ✅ NEW: `canvas/draw-image.spec.ts` — 2 tests covering click and drag flow. |
| **External TSX edits** | Bidirectional sync doc promises both files; only CSS-edit external-sync is tested. |

### Documented behaviour worth quick spec coverage

These are small, deterministic behaviours that would be cheap to spec but currently aren't:

- Cmd+P opens Preview Mode (or at minimum, dispatches the IPC).
- Page-name badge click selects root.
- `(missing)` page label in linking dropdown after a target page is deleted.
- ~~Custom canvas-width input (range 100–4000) drops the breakpoint back to Desktop.~~ → covered ✅ NEW (`canvas/canvas-width.spec.ts`)
- Save-failed Retry button visible after a forced write failure.
- ~~Background-image upload writes `background-image: url(...)` + `background-size/position/repeat` to CSS.~~ → covered ✅ NEW (`properties-panel/background-image.spec.ts`)
- Token-on-canvas live update — **deferred**: a flake-prone double chokidar dance (theme.css + module.css) made the spec fragile. Feature works in real life and is unit-tested in `customProps.test.ts`. Worth revisiting if Scamp grows a deterministic refresh hook.

---

## Recommended priority order for closing gaps

> **Updated 2026-05-08 (post wave 4)**: All originally-prioritised
> items are now closed except the deliberate skips below.

1. ~~Linking happy paths + wrap-only~~ → covered ✅. **Page-rename
   href refactor** needs a nextjs fixture (legacy format doesn't
   refactor — feature is nextjs-only). **Click-icon navigation**
   (browser open / page switch) still open.
2. ~~Element states basic + right-click reset + non-desktop disable~~
   → all covered ✅.
3. ~~Animations basic + 7 controls + Iteration Infinite + ▶ Play
   preview~~ → covered ✅. **Custom-easing editor** (`cubic-bezier(...)`
   round-trip) is the one residual.
4. ~~Box shadow / blend modes / duplicate indicator / PNG-SVG export~~
   → all covered ✅. **Doc updates** still owed for shadows / blend /
   size / duplicate dot / export panel / background-image flow.
5. ~~Free-form Size input + background-image upload + custom canvas
   width~~ → all covered ✅.
6. **Cross-cutting fillers still open**: Cmd+P preview shortcut,
   save-failed Retry button, page-name badge selection, token-on-
   canvas live update (intentionally deferred).
7. **Preview Mode** — likely deferred but worth a single smoke spec
   if a non-flaky dev-server harness can be built.
8. **Doc-only gaps** (not test work): document the duplicate-CSS
   yellow dot, free-form Size input behaviour, shadow panel,
   blend-mode dropdowns, PNG/SVG export panel, background-image flow.
