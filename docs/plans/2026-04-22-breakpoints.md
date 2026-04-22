# Mobile and Tablet Breakpoint Toggles — Plan

**Status:** All phases landed 2026-04-22.
**Date:** 2026-04-22
**Story:** `docs/backlog-2.md` §6.
**Depends on:** Story #5 (canvas size rework) — done.

## Goal

Let users switch the canvas between Desktop / Tablet / Mobile
breakpoints and have style edits automatically land inside the right
`@media (max-width: …)` block. Round-trip cleanly through
`parseCode` / `generateCode`. Render the canvas with the correct
cascaded styles for the active breakpoint.

This is the most invasive story in the backlog — it touches the
element data model, generator, parser, canvas rendering, both panel
modes (UI + raw CSS), the toolbar, `file:patch` IPC, and project
config.

---

## What already works

- `scamp.config.json` already stores `canvasWidth` (story #5). The
  breakpoint toggle can reuse this infrastructure — switching mode
  just sets canvas width and records the active breakpoint.
- The generator + parser separation is clean. Adding `@media` handling
  is additive: parse `@media` into per-breakpoint overrides, emit
  overrides as `@media` blocks at the end of the file.
- The CSS editor already commits via `file:patch` → `patchClassBlock`
  in `src/shared/patchClass.ts`. We extend that with an optional media
  scope.

## What's missing

- **Per-element breakpoint overrides** — new field on `ScampElement`.
- **Active breakpoint state** — new UI-state field in canvasSlice.
- **Breakpoint definitions** — new `ProjectConfig` field + defaults.
- **@media parse / emit** in parseCode / generateCode.
- **Breakpoint-aware canvas rendering** — `ElementRenderer` needs to
  cascade overrides at the active breakpoint.
- **Breakpoint-aware panel** — both UiPanel fields (with override
  indicator + reset) and CssPanel (scoped to the active @media block).
- **Breakpoint toggle control** — likely the existing
  `CanvasSizeControl` reskinned, or a sibling segmented control.
- **`file:patch` media-scoped** — new optional `media` arg on the IPC
  and `patchClassBlock` helper.
- **Project settings page** — breakpoint values + add-custom UI.

---

## Key design decisions (flag for review)

### 1. Data model — typed partials keyed by breakpoint id

Add one new field to `ScampElement`:

```ts
type ScampElement = {
  // ...existing fields...
  /**
   * Per-breakpoint style overrides. Keys are breakpoint IDs (matching
   * entries in `ProjectConfig.breakpoints`). Values carry only the
   * fields the user overrode at that breakpoint — everything else
   * inherits from the base (desktop) styles on the element itself.
   */
  breakpointOverrides?: Record<string, BreakpointOverride>;
};

/**
 * Which `ScampElement` fields a breakpoint can override. Excludes
 * identity / tree fields (id, type, parentId, childIds) and the
 * override map itself — a breakpoint can't re-parent an element or
 * nest its own overrides.
 */
type BreakpointOverride = Partial<
  Omit<ScampElement, 'id' | 'type' | 'parentId' | 'childIds' | 'breakpointOverrides' | 'tag' | 'attributes' | 'selectOptions' | 'svgSource'>
>;
```

**Excluded from overrides** (justification):
- Tree / identity fields — can't change per-breakpoint.
- `tag`, `attributes`, `selectOptions`, `svgSource` — these are
  TSX-level, not CSS-level. A breakpoint changes CSS only.
- `text` — content doesn't change per breakpoint in this story.

**Why typed partial, not a free-form declaration bag:**
- UiPanel sections already read typed fields; reading
  `override[bp]?.padding ?? element.padding` is one line, and
  has-override detection is a simple `in` check.
- `customProperties` lives inside the Partial, so unknown CSS (e.g. a
  user's hand-written `@media { .rect { box-shadow: … } }`) still
  round-trips via `Partial<ScampElement>.customProperties`.

### 2. Breakpoint identity — id + label + max-width

```ts
type Breakpoint = {
  /** Stable id used as the key in `breakpointOverrides`. */
  id: string;
  /** Display label in the UI (e.g. "Tablet"). */
  label: string;
  /** Max-width in pixels. The @media block becomes `(max-width: Npx)`. */
  width: number;
};
```

`ProjectConfig.breakpoints` is a plain array, ordered widest →
narrowest so rendering + emission iteration is straightforward.

**Desktop is a breakpoint but it's special:** it has no `@media`
wrapper and its overrides are really the base styles on the element.
Concretely: **desktop is NOT stored as an entry in
`breakpointOverrides`.** The `activeBreakpointId === 'desktop'` mode
edits the element's top-level fields directly. Every non-desktop
breakpoint lives in `breakpointOverrides`.

Defaults:
```ts
breakpoints: [
  { id: 'desktop', label: 'Desktop', width: 1440 },
  { id: 'tablet',  label: 'Tablet',  width: 768  },
  { id: 'mobile',  label: 'Mobile',  width: 390  },
]
```

### 3. Active breakpoint state — in canvasSlice

Transient UI state, not persisted:

```ts
// canvasSlice additions
activeBreakpointId: string;  // default 'desktop'
setActiveBreakpoint: (id: string) => void;
```

Switching breakpoints does two things:
1. Sets `activeBreakpointId`.
2. Writes `canvasWidth` in `scamp.config.json` to the breakpoint's
   width.

### 4. Canvas width vs breakpoint — coupling + escape hatch

**Coupled** — the `CanvasSizeControl` preset buttons become the
breakpoint toggle. Clicking "Tablet" sets both the canvas width AND
the active breakpoint.

**Custom widths** — when the user enters a custom width that doesn't
match any defined breakpoint, we drop the active breakpoint to
`'desktop'` (editing base styles). This matches the user's mental
model: "I've left the preset sizes, so I'm not editing a specific
breakpoint."

Alternative we're rejecting: keep breakpoint as a separate toggle
that's independent from canvas width. More UI surface for a case the
story explicitly ties together.

### 5. Cascade rules — widest → narrowest, narrower wins

`max-width: 768px` matches viewports ≤ 768 (includes tablet AND
mobile). `max-width: 390px` matches only mobile. When rendering at
mobile, both apply; mobile wins because it's later in source order.

**Rendering cascade:**
```
baseStyles = element's top-level fields
for each breakpoint with width >= activeBreakpoint.width,
  in DESCENDING order (widest first):
    merge override[breakpoint.id] on top of baseStyles
renderWith(baseStyles)
```

**Generation order:** emit `@media` blocks widest → narrowest after
the base block. Narrower overrides that come later in the file
naturally win in CSS cascade.

### 6. Parser — known vs unknown @media blocks

- **Known** (`@media (max-width: 768px)` matching a defined
  breakpoint width) → walk the rules inside, apply declarations to
  `element.breakpointOverrides[tablet.id].<field>` via the same
  `cssToScampProperty` mapper we use for base styles.
- **Unknown** (`@media (min-width: 600px)`, `@media (prefers-color-scheme: dark)`,
  custom breakpoints not in project config, etc.) → store the entire
  @media block verbatim at the **project level** (a new
  `customMediaBlocks` array on `ParsedTree`, preserved and re-emitted
  after the known ones). This means Scamp doesn't lose agent-written
  media queries it doesn't understand.

**Open question:** do we preserve at the project level, or at the
element level (splitting unknown @media into a customProperties-like
bag per element)? I recommend project-level — simpler, matches the
shape of @media in CSS, and agent-written queries that span multiple
classes stay intact.

### 7. `file:patch` IPC — add optional media scope

```ts
type FilePatchArgs = {
  cssPath: string;
  className: string;
  newDeclarations: string;
  /** When present, the patch operates inside an @media block with
   *  this max-width. When absent, patches the base class block as
   *  today. */
  media?: { maxWidth: number };
};
```

`patchClassBlock` grows to accept an optional media scope. Under the
hood: when `media` is provided, find or create the matching `@media`
AtRule, then find-or-create the class rule inside it, then replace
its declarations.

### 8. Panel behavior — in non-desktop mode

- **Every UiPanel field** reads its display value from the resolved
  cascade (base + overrides up through active breakpoint).
- **Editing a field** writes to `breakpointOverrides[activeId]` only,
  never to the base.
- **Has-override indicator** — small dot on field labels when the
  active breakpoint (or a broader one that cascades down) defines a
  value for that field. Tooltip: "Overridden at Tablet. Click to
  reset."
- **Reset** — right-click a field (or shift-click the dot) clears
  that field from `breakpointOverrides[activeId]`. If the override
  object becomes empty, delete the whole key.

### 9. CssPanel — scope to the active @media block

- Desktop mode: unchanged.
- Tablet/Mobile mode: the textarea body contains only the
  declarations that would go INSIDE the active breakpoint's @media
  block for this class. Commits via `savePatch({ media: {maxWidth} })`.

---

## Phased rollout

### Phase 1 — Data model + storage (no UI yet) ✅ **Done (2026-04-22)**

1. Extend `ScampElement` with `breakpointOverrides`.
2. Extend `ProjectConfig` with `breakpoints: Breakpoint[]` +
   `DEFAULT_PROJECT_CONFIG` additions. Validate in
   `src/shared/projectConfig.ts` (default fallback, clamp widths).
3. Add `activeBreakpointId` + `setActiveBreakpoint` to canvasSlice.
4. Plumb `projectConfig.breakpoints` through to `Viewport` /
   `ProjectShell` as needed.

### Phase 2 — Parser + generator round-trip ✅ **Done (2026-04-22)**

1. **Generator** — new `generateCode` responsibility:
   - Emit base blocks as today.
   - After base, iterate breakpoints (excluding desktop) widest →
     narrowest. For each breakpoint, collect elements with
     `breakpointOverrides[bp.id]` set; emit an `@media
     (max-width: Npx)` block containing one class rule per such
     element, with only the overridden declarations.
   - Append any `customMediaBlocks` from the project/state verbatim
     at the end.
2. **Parser** — `parseCode`:
   - Walk all `@media` at-rules in the CSS.
   - If the query matches `(max-width: Npx)` and `N` equals a known
     breakpoint's width → parse rules inside, apply declarations via
     `applyDeclarations` onto `element.breakpointOverrides[bp.id]`.
   - Unknown @media → collect into `ParsedTree.customMediaBlocks`
     (new field).
3. **Tests:**
   - Round-trip: element with tablet + mobile override → generate →
     parse → `toEqual` original.
   - Unknown @media preserved verbatim.
   - Cascade order: mobile rule appears after tablet rule in output.

### Phase 3 — Canvas rendering ✅ **Done (2026-04-22)**

1. New helper in `src/renderer/lib/breakpointCascade.ts`:
   `resolveElementAtBreakpoint(element, activeBreakpointId, breakpoints) → ResolvedStyles`.
   Applies override cascade.
2. `ElementRenderer` calls the helper and uses the resolved styles
   instead of the raw element fields. Non-style fields (tag, text,
   src, etc.) continue to read from the base element.
3. **Test:** render at mobile → style reflects mobile override;
   switch to desktop → base shows again.

### Phase 4 — UiPanel integration ✅ **Done (2026-04-22)**

1. Each section's field reads `resolved[field]` instead of
   `element[field]` (via a `useResolvedElement(elementId)` hook).
2. Each field's `onChange` routes through a new store action
   `patchElementAtBreakpoint(id, breakpoint, patch)` that writes to
   the override map when `breakpoint !== 'desktop'`, and to the base
   fields when it is.
3. Has-override indicator: compute per-field
   `isOverridden = activeBreakpointId !== 'desktop' && field in overrides[activeId]`.
   Add a small dot to the section `Row` component.
4. Reset: shift-click / right-click calls
   `resetElementFieldAtBreakpoint(id, breakpoint, field)`.

### Phase 5 — Breakpoint toggle UI ✅ **Done (2026-04-22)**

1. Replace (or extend) `CanvasSizeControl` with a segmented toggle
   showing Desktop / Tablet / Mobile. Each button sets the canvas
   width AND the active breakpoint.
2. Custom-width input stays in the popover. Typing a non-preset
   width drops active breakpoint to desktop.
3. The canvas-header badge ("Desktop - 1440") already shows the
   current mode; update its label to show the breakpoint name +
   width.

### Phase 6 — Raw CSS editor scoping ✅ **Done (2026-04-22)**

1. `CssPanel` reads declarations for the ACTIVE breakpoint only.
2. `savePatch` call passes the media scope when not desktop.
3. `patchClassBlock` (`src/shared/patchClass.ts`) handles the media
   scope — find/create the @media at-rule then find/create the class
   rule inside it.
4. IPC: extend `FilePatchArgs` with optional `media`.
5. Integration test: `test/integration/filePatch.integration.test.ts`
   grows cases for media-scoped patches.

### Phase 7 — Project settings ✅ **Done (2026-04-22)**

1. `ProjectSettingsPage` gains a "Breakpoints" section.
2. List breakpoints in order (widest first). Each row: label, width
   input, delete button. "+ Add breakpoint" at the bottom.
3. Desktop row is a special case — its width is the canvas-width
   default, no @media block. Probably not editable (or editable but
   renames to "Desktop" and stays non-media).
4. Changing a breakpoint's width rewrites any existing
   `breakpointOverrides[id]` entries under the new width implicitly
   (the id is stable, width is just metadata).

### Phase 8 — Agent.md ✅ **Done (2026-04-22)**

Document the `@media` convention:
- Scamp groups breakpoint overrides in `@media (max-width: Npx)`
  blocks at the bottom of each module.
- Don't write nested @media or media queries with conditions other
  than `max-width` unless you want Scamp to preserve them verbatim
  (they become untouchable agent-only zones).

---

## File-by-file changes

| File | Phase | What |
|---|---|---|
| `src/renderer/lib/element.ts` | 1 | `ScampElement.breakpointOverrides`, `BreakpointOverride` type |
| `src/shared/types.ts` | 1 | `Breakpoint` type, `ProjectConfig.breakpoints`, defaults |
| `src/shared/projectConfig.ts` | 1 | Parse + validate breakpoint array; clamp widths |
| `src/renderer/store/canvasSlice.ts` | 1, 4 | `activeBreakpointId`, `setActiveBreakpoint`, `patchElementAtBreakpoint`, `resetElementFieldAtBreakpoint` |
| `src/renderer/lib/generateCode.ts` | 2 | Emit base + ordered @media blocks |
| `src/renderer/lib/parseCode.ts` | 2 | Walk @media at-rules, route into overrides or custom bag; `ParsedTree.customMediaBlocks` |
| `src/renderer/lib/breakpointCascade.ts` (new) | 3 | `resolveElementAtBreakpoint` helper |
| `src/renderer/src/canvas/ElementRenderer.tsx` | 3 | Use resolved styles |
| `src/renderer/src/components/UiPanel.tsx` + every section | 4 | Read resolved, write via breakpoint-aware action, render has-override indicator |
| `src/renderer/src/components/sections/Section.tsx` | 4 | Row grows an `overridden` affordance (dot + reset handler) |
| `src/renderer/src/components/CanvasSizeControl.tsx` | 5 | Preset buttons set breakpoint; segmented appearance |
| `src/renderer/src/components/ProjectShell.tsx` | 5 | Wire `setActiveBreakpoint` to the size control |
| `src/renderer/src/components/CssPanel.tsx` | 6 | Scope editor body + save to active breakpoint |
| `src/shared/patchClass.ts` | 6 | Media-scoped patching |
| `src/shared/types.ts` | 6 | `FilePatchArgs.media` |
| `src/main/ipc/file.ts` | 6 | Pass media through to patchClassBlock |
| `src/preload/index.ts` | 6 | Surface media on `patchFile` |
| `src/renderer/src/components/ProjectSettingsPage.tsx` | 7 | Breakpoints section |
| `src/shared/agentMd.ts` | 8 | Document @media convention |
| `test/parseCode.test.ts` | 2 | @media round-trip tests |
| `test/generateCode.test.ts` | 2 | @media emission + order |
| `test/integration/sync.integration.test.ts` | 2 | Full-tree round-trip with overrides |
| `test/integration/filePatch.integration.test.ts` | 6 | Media-scoped patch |
| `test/breakpointCascade.test.ts` (new) | 3 | Resolve helper unit tests |

---

## Risks / gotchas

1. **Existing element mutations pathway.** `patchElement` is called
   from everywhere (drag, resize, panel, keyboard nudge, duplicate,
   paste). In non-desktop mode, EVERY edit must route to the
   breakpoint. Two options: (a) every call site learns about
   breakpoints, (b) `patchElement` itself reads
   `activeBreakpointId` from the store and routes internally.
   **Recommend (b)** — single choke point, fewer mistakes. Tradeoff:
   the store action becomes less pure. Document the coupling.

2. **Drag/resize at mobile.** If user drags a rectangle at mobile, do
   we override `x`, `y`, `widthValue` at mobile? The story doesn't
   say. Real-world: responsive layouts rarely use absolute
   positioning. **Recommend:** dragging at non-desktop mode creates
   per-breakpoint position overrides. It's what the data model
   supports for free; if the user doesn't want it they can reset the
   field.

3. **Cascade ambiguity when breakpoints are reordered.** If the user
   reorders breakpoints in project settings, the render cascade
   changes. Acceptable — advanced UX behind a settings panel.

4. **Cloning / duplicating at a breakpoint.** `cloneElementSubtree`
   spreads the element including `breakpointOverrides`. Clones
   inherit overrides. That's what we want.

5. **Migration.** Projects without breakpoint info backfill to
   defaults via `ensureProjectConfig`. No element data migration
   needed — missing `breakpointOverrides` just means no overrides.

6. **`file:patch` find-or-create at-rule complexity.** postcss handles
   this but the logic grows. Keep the new media-scoped path unit
   tested in isolation.

7. **Has-override indicator at wider breakpoints.** If tablet
   overrides `padding: 12px` and mobile doesn't override padding,
   then at mobile the resolved padding is 12px (cascade). Show the
   dot at MOBILE too, or only when the active breakpoint defines the
   override directly? **Recommend** showing the dot when the value
   differs from the raw desktop base (any breakpoint in the cascade
   contributed). Makes the UI honest about where the value is coming
   from.

8. **The CssPanel + raw edits.** If the user writes something in the
   raw editor that the mapper doesn't understand, it currently lands
   in `customProperties`. Same treatment per-breakpoint:
   `breakpointOverrides[bp].customProperties`. OK.

9. **Empty override objects.** After a reset, if the override object
   for a breakpoint is empty, delete the key so round-trip stays
   text-stable.

10. **Scope discipline.** The story is gigantic. Recommend landing
    Phases 1–3 as one set (round-trip + rendering works without any
    UI), then UI phases on top. Each phase is independently
    reviewable.

---

## Out of scope

- Nested media queries, `min-width` breakpoints, orientation queries,
  color-scheme queries.
- Different `ScampElement.type` at different breakpoints (e.g. img on
  desktop, svg on mobile).
- Breakpoint-specific children (showing different trees at different
  sizes).
- Responsive values based on viewport (`clamp()`, `vw` units) —
  users can write these in `customProperties` and they pass through
  untouched.
- Breakpoint previewing grid view (Figma-style show-all-breakpoints-
  at-once).
- Copy-paste of breakpoint overrides between elements.
