# Canvas as Browser-Window Simulator — Plan

**Status:** Draft for review (revised 2026-05-01).
**Date:** 2026-05-01
**Source:** Surfaced while debugging preview mode (#5) — the root
element renders 0px tall in production because the page CSS has no
height anywhere and the body has default browser margins.
**Related:** Canvas size rework
(`docs/plans/2026-04-21-canvas-size-rework.md`, shipped — moved width
out of root CSS), preview mode (#5, just shipped).

## Goal

The canvas is a **browser-window simulator**, like Chrome DevTools'
responsive mode. The user picks a viewport width (preset or custom),
the canvas frame paints at that width, and the design's height grows
naturally as elements are added. Breakpoints fire at the configured
widths just like in a real browser.

The generated TSX + CSS must run in any browser at any width. Nothing
about the canvas's chosen viewport gets baked into the production CSS
— width selection is a design-time tool, not a deployed dimension.

The "preview is blank" bug is a separate, narrow problem: the root
element has no height in production because nothing in the generated
CSS ever gives it one, and the surrounding `<body>` has the browser's
default 8px margin and no minimum height. Fix those two things and
preview matches what the canvas already shows.

---

## Mental model — what the canvas is and isn't

| Concept | Lives where | Affects production CSS? |
|---|---|---|
| Canvas viewport width (preset / custom) | `projectConfig.canvasWidth` | **No** — design-tool only |
| Canvas frame height | Grows with the design (intrinsic) | **No** — not stored anywhere |
| Active breakpoint | Derived from `canvasWidth` vs. `breakpoints[]` | Yes — `@media` rules |
| Element styles (base + overrides) | Element tree | Yes — class CSS |
| Root needs visible height in any browser | `min-height: 100vh` on root + body reset | Yes — but constant, not configured |

The first two rows are the heart of the shift: the canvas is a
*viewport*, not a page frame whose dimensions get embedded in the
output. Same code, any browser, any width.

---

## What's actually broken

Two narrow bugs, both about page chrome rather than canvas sizing:

1. **Root has no height in production.** `DEFAULT_ROOT_STYLES` has
   `widthMode: 'stretch'` (emits `width: 100%`) but `heightMode:
   'auto'` (emits no height). Children with `position: absolute`
   don't contribute to the root's box, so the root collapses to
   0px. The Scamp canvas hides this by giving the frame an
   `EMPTY_FRAME_MIN_HEIGHT: 900` floor — production has no such
   floor.
2. **Body has no reset.** Auto-generated `app/layout.tsx` wraps
   `<body>{children}</body>` with no styles. Even if the root had
   a height, the browser's default 8px body margin and lack of a
   minimum body height make the page chrome unpredictable across
   viewports.

That's it. No new config fields, no canvas-dimension routing, no
generator parameterisation by project state.

---

## The fix

### 1. Root emits `min-height: 100vh`

Update `DEFAULT_ROOT_STYLES` (or the root branch of
`elementDeclarationLines`) so the root's CSS gets:

```css
.root {
  width: 100%;
  min-height: 100vh;        /* NEW */
  position: relative;
  /* …other root styles… */
}
```

`min-height` (not `height`) so a long page can grow past one
viewport. `100vh` means "fill at least the user's window" — works
in any browser at any width without baking in a Scamp-chosen
number.

The user can override per-element via the panel (it's just CSS) or
override per-breakpoint if they want a taller floor on desktop.

### 2. `<body>` reset in the auto-generated layout

`defaultLayoutTsx` adds an inline body style:

```tsx
<body style={{ margin: 0, minHeight: '100vh' }}>{children}</body>
```

`margin: 0` removes the browser's default 8px gutter (which
otherwise pushes content off-axis from how it looks in the canvas).
`minHeight: '100vh'` ensures the body matches the viewport even
if the root somehow didn't; redundant in the happy case, but cheap
insurance.

Inline style (rather than a CSS file) keeps it visible in the
template the user reads, and avoids a new globals.css.

### 3. (Optional) Canvas frame height grows naturally

The canvas frame already grows past `EMPTY_FRAME_MIN_HEIGHT` as
content is added (via `min-height` on the frame element — see
`Viewport.tsx`). Today's behaviour effectively matches "design
height grows with content" already, so no change required here.

If we want the frame's empty-state floor to itself be `100vh`-ish
(to match what the user will see in production), we can swap
`EMPTY_FRAME_MIN_HEIGHT` for measuring the artboard height. Low
priority — file under "polish."

---

## What changes in the model

**Nothing in `ProjectConfig`.** Canvas width stays exactly as it
is — already supports preset / custom and persists per-project. No
new fields.

**Nothing in `parseCode`.** The new `min-height: 100vh` lives in
the generated root CSS. If the user (or an agent) deletes or
overrides it, that's their call — `parseCode` already routes
unknown declarations through `customProperties`, so it round-trips.

The one subtlety: `min-height` isn't currently in the typed
`cssPropertyMap`, so it'd land in `customProperties` on the root.
Two options:

- **A. Leave it in `customProperties`.** Generator emits it
  unconditionally as part of the root template; parser picks it up
  via the customProperties path. Simplest. Risk: if the parsed
  customProperties ever flow back into the generator, we'd
  double-emit.
- **B. Add `min-height` to the typed property map** so it's a
  first-class root-only declaration the generator owns. Cleaner;
  more consistent with how `width` is handled.

My pick: **B**, because the generator already emits `width: 100%`
explicitly for the root and treating `min-height` the same way
keeps the round-trip symmetric. Slightly more code, but no risk
of duplication.

---

## Implementation phases

### Phase 1 — Generator emits `min-height: 100vh` on root

1. Extend the root branch of `elementDeclarationLines` (or the
   equivalent helper in `generateCode.ts`) to emit
   `min-height: 100vh` after `width: 100%`.
2. Tests in `test/generateCode.test.ts`:
   - Root rule contains `min-height: 100vh`.
   - Non-root rules don't get `min-height` injected.
   - Round-trip: `generateCode` → `parseCode` → `generateCode`
     produces identical output.

**Acceptance:** generated root CSS has `min-height: 100vh`;
existing round-trip test still passes.

### Phase 2 — Parser recognises root `min-height`

1. Add `min-height` to the typed `cssPropertyMap` so it round-trips
   without going through `customProperties`.
2. Tests:
   - Parsing a root with `min-height: 100vh;` produces an element
     whose root template will re-emit the same value.
   - The same declaration on a non-root class still round-trips
     (via customProperties or the typed property — either is fine
     as long as it's stable).

**Acceptance:** generator → parser → generator is byte-stable.

### Phase 3 — `app/layout.tsx` body reset

1. Update `defaultLayoutTsx` in `src/shared/agentMd.ts` to add the
   inline body style.
2. Add a small constant (e.g. `LEGACY_LAYOUT_TEMPLATES: string[]`)
   tracking the previous template strings — used by Phase 4's
   migrator.
3. Tests in `test/agentMd.test.ts` (or wherever layout templates
   are tested today) assert the new template includes the body
   reset.

**Acceptance:** new projects get the body reset; old template
strings are retained for migration matching.

### Phase 4 — Migration for existing projects

On project open, if `app/layout.tsx` byte-matches one of the
`LEGACY_LAYOUT_TEMPLATES`, silently replace it with the new one.
If the user has customised it (no match), leave it alone and log
a one-line hint to the app log:

> *"Your `app/layout.tsx` doesn't include the recommended body
> reset (`margin: 0; min-height: 100vh`). Preview may render with
> the browser's default body margin until you add it."*

**Acceptance:** existing untouched projects pick up the body
reset on next open; customised layouts aren't trampled.

### Phase 5 — Migration for existing root CSS

Existing pages have root CSS without `min-height: 100vh`. Two
choices:

- **A. Lazy:** the next time a user touches anything that
  triggers a CSS rewrite, the new root template lands and the
  declaration appears. Low-risk, but the page still looks broken
  in preview until that touch happens.
- **B. Eager on open:** scan each page's CSS module on open, and
  if the root rule lacks `min-height`, append it. Single
  one-shot file write per page.

My pick: **A (lazy)** — preview already works once the user does
*any* edit, and the eager path means writing files the user didn't
ask us to touch. Document the lazy behaviour in the migration
hint above so users who hit the issue know how to resolve it
("edit and save any element to refresh").

**Acceptance:** existing projects work in preview after any
canvas-triggered save; no surprise file writes on open.

### Phase 6 — Polish + docs

- `agent.md` (nextjs template) — note that the root has
  `width: 100%; min-height: 100vh` and that the body has the
  reset. Note that canvas viewport width is design-time only and
  doesn't appear in the CSS.
- `CONTRIBUTING.md` — short section on the canvas-as-viewport
  model.
- Backlog — entry for "intrinsic-flow design mode" (root
  positions children with flex/grid; height is purely intrinsic
  to children, no `100vh` floor needed). Out of scope here.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/renderer/lib/generateCode.ts` | Root rule gains `min-height: 100vh`. |
| `src/renderer/lib/cssPropertyMap.ts` | Add `min-height` as a typed declaration so it round-trips cleanly. |
| `src/renderer/lib/parseCode.ts` | Picks up `min-height` via the typed map (no special-casing needed). |
| `src/shared/agentMd.ts` | `defaultLayoutTsx` adds body reset. New `LEGACY_LAYOUT_TEMPLATES` constant. |
| `src/main/ipc/projectMigrate.ts` (or new helper) | On open, replace `app/layout.tsx` if it matches a legacy template byte-for-byte. |
| `test/generateCode.test.ts` | Root emits `min-height: 100vh`; non-root doesn't. |
| `test/parseCode.test.ts` | `min-height` round-trips on root. |
| `test/agentMd.test.ts` | New layout template includes body reset. |

Notably **not** touched: `ProjectConfig`, `Viewport.tsx`, the
sync bridge, ProjectShell parse routing, `CanvasSizeControl`. The
canvas already behaves like a viewport; only the production
output needs to gain a height floor.

---

## High-level architecture

```
┌──────────────────────────────────────────────────────┐
│ scamp.config.json                                    │
│  canvasWidth: 1440  ← viewport width (DESIGN-TIME)   │
│  breakpoints: [...] ← responsive breakpoints         │
└──────────────────────────────────────────────────────┘
        │
        └─→ Canvas frame paints at canvasWidth
            Frame height grows with content
            Active breakpoint derived from canvasWidth
            (None of this touches the generated CSS)

┌──────────────────────────────────────────────────────┐
│ generated page CSS (.module.css)                     │
│  .root {                                             │
│    width: 100%;                                      │
│    min-height: 100vh;       ← NEW                    │
│    position: relative;                               │
│  }                                                   │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ app/layout.tsx                                       │
│  <body style={{ margin: 0, minHeight: '100vh' }}>    │
└──────────────────────────────────────────────────────┘

Result in preview / next dev / production:
- Body fills the viewport, no default margin
- Root fills the body, absolute children paint over it visibly
- Content can grow past 100vh naturally (page scrolls)
- Page looks the same at every browser width
- Breakpoints kick in to adapt the design at narrower widths
```

---

## Open questions (please review)

**Q1. `min-height: 100vh` on root, or rely solely on the body
reset?**
Plan: emit it on root. The body reset alone gives the body
height, but the absolute children mean the root still collapses
to 0 unless it has its own minimum. My pick: **both**, because
the root needs the minimum independent of how it's wrapped.
Confirming. -  Agreed

**Q2. Eager vs lazy migration of existing root CSS**
Plan: lazy — wait for the user's next edit to land the
declaration. Eager would scan and rewrite every page on open. My
pick: **lazy** — surprise file writes on open are riskier than
asking the user to make any edit when they hit the issue.
Confirming. Agreed

**Q3. `min-height` as a typed declaration vs. customProperties**
Plan: add it to the typed property map so the generator owns
emission and the parser doesn't double-route it. Alternative:
let it ride through customProperties. My pick: **typed** —
matches how `width` is handled today; more symmetric.
Confirming. agreed

**Q4. Body reset: inline style vs. globals.css**
Plan: inline `style={{ margin: 0, minHeight: '100vh' }}` on
`<body>`. Alternative: emit a `globals.css` and import it in
layout.tsx. My pick: **inline** — visible in the template, no
new file, no Tailwind-style cascade arguments. Confirming. Agreed

**Q5. Migration hint logging**
Plan: log a one-line hint to the app log when an
existing-but-customised `app/layout.tsx` doesn't have the body
reset. Alternative: surface a banner in the UI. My pick: **log
only** for now — banners for migration concerns are noisy and
this issue is self-resolving (the user notices their preview is
weird, googles, finds the hint). Reconsider if it's a common
support burden. agreed

---

## Out of scope

- **Per-page or per-project customisable height floors.** The
  `100vh` value is a constant. If a user wants a taller floor on
  desktop, they override `min-height` on the root via the panel
  (or per-breakpoint). No new config UI for this.
- **Intrinsic-flow design mode** (Scamp picks flex/grid layout for
  new elements by default, removing the need for absolute
  positioning's height-collapse problem). Backlog.
- **`overflow: hidden` on body** for designers who want the page
  to never scroll. Out of scope; users add via customProperties.
- **Legacy-format projects.** They can't run preview anyway
  (already gated on nextjs format), and their root CSS isn't
  managed by `defaultLayoutTsx`. No change here.
- **Canvas frame's empty-state floor matching `100vh`.** The
  current `EMPTY_FRAME_MIN_HEIGHT: 900` is fine for the canvas
  visually; matching `100vh` to the actual viewport is polish.

---

## Risks

- **Existing projects don't get the fix until the next save.**
  Lazy migration means a user who opens an existing project,
  hits Preview, and sees a blank page has to make any edit
  before the root CSS gains the `min-height`. Mitigation: the
  migration log hint tells them what to do; documentation in
  `agent.md` makes it discoverable.
- **`min-height: 100vh` is opinionated.** A site with intrinsic-
  flow layout (e.g. a header nav, a 200px body, no absolute
  positioning) gets a floor it doesn't need. Visually harmless —
  the page just has extra empty space below the content if total
  height is under 100vh — but it's a default the user can
  override via panel.
- **Auto-rewriting `app/layout.tsx`.** Even with byte-equivalence,
  a user who somehow has a layout matching the legacy template
  exactly and *intends* to keep it that way will see it changed.
  Mitigation: strict byte match; legacy templates list is
  finite and known.
- **`min-height` declared on a non-root element.** With Q3's typed
  property map, it round-trips for any element. Probably fine —
  users may genuinely want it on individual elements. No risk
  beyond making sure tests cover both cases.
