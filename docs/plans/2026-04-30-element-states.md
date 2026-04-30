# Per-Element States (hover, active, focus) — Plan

**Status:** Draft for review.
**Date:** 2026-04-30
**Source:** `docs/backlog-3.md` story #3
**Related:** transitions (story #1, done), breakpoints (already shipped),
CSS animations (story #4, future)

## Goal

Let users design `:hover`, `:active`, and `:focus` styles for any
element directly from the WYSIWYG panel. Edits write real CSS
pseudo-class blocks; parser reads them back. The canvas can preview a
state on demand so the user sees the result without hand-triggering it
in a browser.

---

## Current state — what we can build on

The breakpoints system already implements the core "per-axis style
override" pattern this story needs. Re-using its shape keeps the
codebase consistent and reduces the surface area to test.

What's already there (from `src/renderer/lib/element.ts` and friends):

- `BreakpointOverride = Partial<Omit<ScampElement, …identity/content>>`
  — a typed subset of fields a non-base axis can override.
- `breakpointOverrides?: Record<string, BreakpointOverride>` on
  `ScampElement`, keyed by breakpoint id. Empty / unset key means "no
  override at that breakpoint."
- `resolveElementAtBreakpoint(element, activeId, breakpoints)` —
  cascading resolver that overlays applicable overrides onto the base.
- `useResolvedElement` — React hook that returns the cascaded element
  for the active breakpoint. Sections use it so they always show "the
  value as it will render."
- `useBreakpointOverrideFields` — returns the set of field names the
  active breakpoint is overriding, so sections can render a
  "has-override" indicator.
- `applyPatchWithBreakpointRouting` — patch helper in the store that
  routes edits to the active breakpoint's override bucket when the
  user isn't on desktop.
- `BreakpointSwitcher` UI at the top of the properties panel.
- `generateCode` emits `@media (max-width: Npx)` blocks at the bottom
  of the CSS module; `parseCode` routes them back into
  `breakpointOverrides`.

State overrides follow the same shape with a smaller fixed set of
keys (`hover`, `active`, `focus`) and a different CSS emit (pseudo-
class block right after the base, instead of a separate at-rule
section).

---

## Non-goals for this story

- **State × breakpoint combinations** (e.g. a different hover style on
  mobile vs desktop). Worth doing eventually — the data model leaves
  room — but multiplying axes in this story makes the panel UX and
  the resolver substantially harder. POC ships desktop-only states.
- **`:focus-visible`, `:disabled`, `:checked`, `:nth-child`, custom
  selectors.** Round-trip preserved verbatim (see "Pseudo-class
  passthrough") but not modelled.
- **Real interactive hover/focus on the canvas.** Scamp is a design
  tool — users see a state by switching to it in the properties
  panel, not by actually mousing over the rendered element. Real
  runtime preview (browser-like hover/focus triggering, animations
  playing through) is reserved for the future **preview mode**
  project (story #5 in `backlog-3.md`).
- **Transient canvas hover preview & per-state lock toggle.** Earlier
  draft of this plan included an eye-icon "lock" and a pointermove
  hover preview. Removed in favour of the simpler "state switcher IS
  the preview" model below.
- **State-specific transitions.** The transition shorthand on the base
  applies to all state changes automatically (correct CSS behaviour);
  per-state transitions are a separate feature.

---

## Data model

### New type

```ts
// src/renderer/lib/element.ts

export type ElementStateName = 'hover' | 'active' | 'focus';

export const ELEMENT_STATES: ReadonlyArray<ElementStateName> = [
  'hover',
  'active',
  'focus',
];

/**
 * Subset of element fields a per-state override can carry. Same
 * exclusions as `BreakpointOverride` — states change CSS only, not
 * tree shape, attributes, text, or breakpoints. (And not nested
 * states — no `:hover:active` in this story.)
 */
export type StateOverride = Partial<
  Omit<
    ScampElement,
    | 'id'
    | 'type'
    | 'parentId'
    | 'childIds'
    | 'breakpointOverrides'
    | 'stateOverrides'
    | 'tag'
    | 'attributes'
    | 'selectOptions'
    | 'svgSource'
    | 'text'
    | 'name'
    // Position is excluded too: `transform: translateY(-2px)` lives in
    // customProperties, which IS in the override. Layout-changing
    // position values aren't supported on hover (would cause layout
    // shift). Keep `position` / `x` / `y` out for now.
    | 'position'
    | 'x'
    | 'y'
  >
>;
```

**Field exclusions vs `BreakpointOverride`:**

- `position`, `x`, `y` — excluded. Hover layout shifts are bad UX and
  don't happen via these fields anyway (users use `transform`, which
  flows through `customProperties`).
- `widthMode`, `heightMode`, `padding`, `margin` — included. A hover
  state can grow padding or change width mode (`width: fit-content` →
  `width: 100%`). This matches what real designers reach for.
- `transitions` — included? **No.** A transition declared on the base
  applies to all state changes. Allowing a per-state `transitions`
  override would let the user set `transition: none` on hover,
  effectively disabling animation when entering hover, which is a
  legitimate use case but adds complexity. Defer to a follow-up.

### Extended ScampElement

```ts
export interface ScampElement {
  // ... existing fields ...
  breakpointOverrides?: Record<string, BreakpointOverride>;

  /**
   * Per-state style overrides keyed by state name. Each value carries
   * ONLY the fields the user overrode for that state — everything
   * else cascades from the base styles.
   *
   * Default ("rest") state is the element's top-level fields and
   * isn't stored here. When a state's override object would become
   * empty (all fields cleared), the key is deleted so round-trips
   * stay text-stable. When the entire `stateOverrides` map is empty,
   * the field itself is removed (not just left as `{}`).
   */
  stateOverrides?: Partial<Record<ElementStateName, StateOverride>>;
}
```

### Pseudo-class passthrough

For `:focus-visible`, `:checked`, `:disabled`, `:nth-child(...)`,
agent-written `[data-x]:hover` selectors, etc. — anything that isn't
a recognised state on a Scamp class — preserve verbatim.

```ts
export type RawSelectorBlock = {
  /**
   * Full selector text, e.g. `.rect_a1b2:focus-visible` or
   * `.rect_a1b2:nth-child(odd)`. Stored verbatim from the source CSS.
   */
  selector: string;
  /** Declaration block content, formatted as the source had it. */
  body: string;
};
```

We already have `customMediaBlocks` at the page level (string array)
for unsupported `@media` queries. Pseudo-class blocks the parser
can't route are stored similarly — at the **element** level since
they're scoped to one class:

```ts
export interface ScampElement {
  // ...
  customSelectorBlocks: ReadonlyArray<RawSelectorBlock>;
}
```

`generateCode` emits these immediately after the element's recognised
state blocks, in their original order. Empty array is the default —
they only appear when the parser actually sees an unrecognised
pseudo-class block.

> Note: the user story says "stored in `customProperties`." That's a
> misstatement — `customProperties` is keyed by CSS *property name*,
> so it can't hold whole rule blocks. The new field above is the
> correct shelf for them. I'll flag this in the implementation
> comments.

---

## Cascade rules

The cascade order from base → rendered values:

1. Element top-level fields (the "rest" / default state).
2. Active breakpoint's `breakpointOverrides[bpId]`, layered widest →
   narrower (existing behaviour, unchanged).
3. Active state's `stateOverrides[stateName]`, when a non-default
   state is active.

Step 3 lands on top so a state override always wins over breakpoint
and base. This matches CSS: a pseudo-class selector at the same
specificity as the base wins by source order, and the generator
emits state blocks AFTER the base block.

**`customProperties` merge.** Object-wise, like breakpoints — a
hover-state `box-shadow` is added to the base's `transform` rather
than wiping it.

```ts
// New resolver — wraps the existing breakpoint resolver.
export const resolveElementAtState = (
  element: ScampElement,
  activeBreakpointId: string,
  breakpoints: ReadonlyArray<Breakpoint>,
  activeState: ElementStateName | null
): ScampElement => {
  const atBreakpoint = resolveElementAtBreakpoint(
    element, activeBreakpointId, breakpoints
  );
  if (!activeState) return atBreakpoint;
  const override = element.stateOverrides?.[activeState];
  if (!override || Object.keys(override).length === 0) return atBreakpoint;
  const mergedCustom = {
    ...atBreakpoint.customProperties,
    ...(override.customProperties ?? {}),
  };
  return { ...atBreakpoint, ...override, customProperties: mergedCustom };
};
```

---

## Code emission — `generateCode`

Per-element CSS layout becomes:

```css
.rect_a1b2 {
  background: #ffffff;
  border-radius: 8px;
}

.rect_a1b2:hover {
  background: #f0f0f0;
}

.rect_a1b2:active {
  background: #e0e0e0;
}

.rect_c3d4 {
  /* ... */
}
```

Order rules:

- States emit in fixed order: `:hover` → `:active` → `:focus`. This
  matches CSS LVHA-ish best practice and gives deterministic output.
- A state block is emitted only when its override has at least one
  field set. Empty / absent overrides emit nothing.
- `customSelectorBlocks` for the element follow the recognised state
  blocks, in their original order.
- `@media` blocks (breakpoints) and page-level `customMediaBlocks`
  still come at the very end of the file.

Inside a state block, only the *changed* fields emit. The override
already only carries changed fields — same shape as the breakpoint
override emitter (`breakpointOverrideLines`). I'll factor a small
shared helper or duplicate the property-emit branches; the latter is
more code but lets each layer evolve independently.

---

## Code parsing — `parseCode`

`postcss` already gives us each selector as a rule. The parser walks
top-level rules; for each rule with a class-prefixed selector:

- `.<className>` (no pseudo) → base declarations for that element.
- `.<className>:hover|:active|:focus` (one of the three recognised
  states) → declarations land in `stateOverrides[stateName]` for the
  matching element.
- Anything else (`.<className>:focus-visible`, `.<className>:checked`,
  `.<className>:nth-child(odd)`, agent-written compound selectors) →
  preserved as a `RawSelectorBlock` on the element's
  `customSelectorBlocks`.

The class-name resolution is the same as today: strip the leading
dot, look up the element by suffix-id (`rect_a1b2` → element id
`a1b2`).

**`@media` blocks containing pseudo-class rules.** Out of scope per
non-goals. If the parser sees `.rect_a1b2:hover` inside an `@media`
block, that block goes into `customMediaBlocks` verbatim (existing
behaviour — the parser already only routes the *base* class rule
inside an @media block to a breakpoint override).

---

## Properties panel — state switcher

### UI placement

```
┌──────────────────────────────┐
│  Properties                  │
│  ────────────────────────    │
│  [Default] [Hover•] [Active] [Focus]   ← state switcher
│  ────────────────────────    │
│  Position [Desktop ▾]        ← breakpoint switcher (existing)
│  ...                         │
│  Sections (Position, Size, …)│
└──────────────────────────────┘
```

State switcher above the breakpoint switcher. States and breakpoints
are independent axes for now (state = desktop only this story); the
two switchers are stacked so the user can think of them as separate
modes.

A small dot (•) on a state button signals that state has at least one
override defined. Removing the last override clears the dot.

### State of the panel when non-default state is active

- Sections render as today, but `useResolvedElement` returns the
  element with the active state's overrides layered on top of base.
- Each field has one of three visual states:
  - **Overridden at this state** — small dot indicator next to the
    label, value editable, edit writes to the state override.
  - **Inherited from default** — value shown at reduced opacity with
    a "Same as default" label or tooltip, edit-on-click promotes the
    value into the state override.
  - **No value at all** (rare — only for fields that genuinely have no
    base value) — same as today.
- "Reset to default" button per-field: removes the field from the
  state override (clears it from CSS). Available when a field is
  overridden at the active state.

### Patch routing

Extend the existing `applyPatchWithBreakpointRouting` so it also
routes through state overrides when both axes are active:

- `activeBreakpointId === 'desktop' && activeState === null` →
  patch lands on element top-level (today's default).
- `activeBreakpointId === 'desktop' && activeState !== null` →
  patch lands in `stateOverrides[activeState]`.
- `activeBreakpointId !== 'desktop' && activeState === null` →
  patch lands in `breakpointOverrides[activeBreakpointId]` (today).
- `activeBreakpointId !== 'desktop' && activeState !== null` →
  rejected for now (out of scope). The state switcher disables
  non-default states when a non-desktop breakpoint is active, with a
  tooltip explaining why ("State styles only available at desktop in
  this version").

### State switcher component

`src/renderer/src/components/StateSwitcher.tsx` — a small inline
segmented control.

```ts
type Props = {
  activeState: ElementStateName | null;     // null === default
  overriddenStates: ReadonlySet<ElementStateName>; // for the dot indicator
  disabled?: boolean;                        // when at a non-desktop breakpoint
  onChange: (state: ElementStateName | null) => void;
};
```

Stored as transient UI state in the canvas store
(`activeStateName: ElementStateName | null`). Like
`activeBreakpointId`, not persisted to disk — it's a panel-local
mode.

---

## Canvas preview

The state switcher *is* the preview. When the user switches to e.g.
Hover, the **selected element(s)** render on the canvas with the
hover overrides layered in via `resolveElementAtState`. Switching
back to Default returns the canvas to the rest-state styles. No
hover events, no eye toggle, no separate preview store field —
`activeStateName` + `selectedElementIds` are sufficient inputs.

This keeps the canvas honest with what the user is editing: the
visible result on screen is exactly what `generateCode` would emit
plus the active state's overrides. If the panel is in Hover mode
and the field they're tweaking is `background`, they see the
selected element's background change as they tweak.

`ElementRenderer` reads `activeStateName` and `selectedElementIds`
from the store. For each rendered element:

```ts
const isSelected = selectedElementIds.includes(element.id);
const stateForRender =
  isSelected && activeStateName !== null ? activeStateName : null;
const resolved = resolveElementAtState(
  element, activeBreakpointId, breakpoints, stateForRender
);
```

Non-selected elements always render with their default-state styles,
because there's no UI affordance for "preview the hover state of an
element I'm not editing." The user can multi-select to preview the
same state across several elements at once — that comes for free.

**Transitions during the preview.** Snap to the new state on switch
rather than animate. When `activeStateName` changes (or selection
changes while a state is active), the renderer skips the transition
shorthand for the affected elements so the user sees the resolved
end state instantly. Concretely: when `stateForRender !== null` for
an element, append `transition: none` to its emitted style. No
effect on the file on disk — renderer-only.

**Live runtime preview** (real `:hover` / `:active` / `:focus`
triggering, transitions playing through, animations cycling) is the
job of the future preview-mode feature (story #5). State editing in
this story is purely a design-time view.

---

## Transitions interaction

Story #1 (transitions) is shipped. From the user story:

> A transition on the default state applies to all state changes
> automatically, which is the correct CSS behaviour.

This is free with our model: the transition declaration emits in the
base block (`.rect_a1b2 { transition: ... }`), and the cascade applies
it to every state. No per-state transition handling needed. The
canvas preview can either:

- **Apply transitions instantly** (snap to hover styles on hover) —
  matches a real browser's behaviour but feels jumpy in a design tool.
- **Skip transitions during preview** so the user sees the resolved
  end state without animation — cleaner for design feedback.

I'd go with the second: when `previewState` is non-null for an
element, set `transition: none` on the rendered element so the
preview is a clean snapshot. (No effect on emitted code; renderer-
only.)

---

## Implementation phases

### Phase 1 — Types & cascade

1. Add `ElementStateName`, `ELEMENT_STATES`, `StateOverride`,
   `RawSelectorBlock` to `src/renderer/lib/element.ts`.
2. Extend `ScampElement` with optional `stateOverrides` and
   `customSelectorBlocks` (default `[]`).
3. Add `resolveElementAtState` in
   `src/renderer/lib/stateCascade.ts`.
4. Unit tests:
   - Resolving an element with no overrides at a state returns the
     element unchanged.
   - Resolving with an override layers correctly on top of base.
   - `customProperties` merge object-wise, not replace.
   - Resolving with `activeState === null` short-circuits.
   - Combining with breakpoints: state override applies on top of
     breakpoint cascade.

**Acceptance:** all existing tests pass; new resolver tests pass.

### Phase 2 — Generator

1. Extend `generateCode` to emit `:hover` / `:active` / `:focus`
   blocks per element, in fixed order, after the base class block.
2. Emit `customSelectorBlocks` after recognised states, in original
   order.
3. Tests:
   - One state with one override emits exactly that block.
   - Empty override emits nothing.
   - All three states emit in fixed order.
   - `customSelectorBlocks` round-trip text-equivalent.
   - State emit happens BEFORE `@media` blocks in source order.

**Acceptance:** generator tests pass; round-trip tests still pass.

### Phase 3 — Parser

1. Extend `parseCode` to detect pseudo-class selectors on Scamp class
   names, route to `stateOverrides`.
2. Route unrecognised pseudo-class blocks to `customSelectorBlocks`.
3. Tests:
   - Parse a single hover block → `stateOverrides.hover` populated.
   - Parse all three states.
   - Parse `.rect_a1b2:focus-visible` → `customSelectorBlocks`.
   - Round-trip: generate a known element with state overrides, parse
     it back, assert `parsed === original`.

**Acceptance:** parser tests pass; the canonical round-trip invariant
holds for elements with state overrides.

### Phase 4 — Store routing

1. Add `activeStateName: ElementStateName | null` to the canvas store.
2. Extend `applyPatchWithBreakpointRouting` (rename to
   `applyPatchWithAxisRouting` or keep the name) to also route
   through state overrides.
3. Add `setActiveState` action.
4. Add `useResolvedElement` extension (or new
   `useResolvedElementForCurrentMode`) that respects both axes.
5. Add `useStateOverrideFields` for the per-field "has-override"
   indicator.

**Acceptance:** patching a field while a state is active writes to
the state override; clearing it removes the field; emptying the
override removes the state key.

### Phase 5 — Properties panel UI

1. New `StateSwitcher` component above the breakpoint switcher.
2. Wire `activeStateName` in/out of the switcher.
3. Render the dot indicator when a state has any overrides.
4. Disable non-default states when at a non-desktop breakpoint, with
   tooltip.
5. Update existing sections to render the "Same as default" /
   reduced-opacity treatment for inherited fields. Add a small
   per-field reset-to-default button when overridden at the active
   state.
6. Visual tests by hand (no e2e for now — the UI is too dense to
   write Playwright assertions against productively).

**Acceptance:** switching to a state and editing values lands in the
right CSS block on disk; switching back to default hides the state-
specific values.

### Phase 6 — Canvas preview

1. `ElementRenderer` reads `activeStateName` and `selectedElementIds`
   from the canvas store. For each element it renders, if the element
   is in the selection AND `activeStateName` is non-null, layer the
   matching state's overrides via `resolveElementAtState`. Non-
   selected elements always render their default state.
2. Suppress transitions on previewed elements (`transition: none` in
   the emitted style only — no effect on disk) so the user sees the
   end state without animation flicker.

**Acceptance:** switching to Hover in the panel visibly applies hover
styles to the selected element on the canvas; switching back to
Default reverts. Non-selected elements aren't affected. Multi-select
applies the preview to all selected elements.

### Phase 7 — Polish & docs

- `agent.md` template gets a "Per-element states" section explaining
  the `.class:hover` / `:active` / `:focus` convention agents should
  follow. Same content for both legacy and nextjs templates.
- `prd-scamp-poc.md` — add a paragraph in the "Features" section
  describing element states.
- CONTRIBUTING.md — note the state-cascade resolver alongside the
  existing breakpoint-cascade docs.

---

## Files changed (anticipated)

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | Add `ElementStateName`, `StateOverride`, `RawSelectorBlock`. Extend `ScampElement`. |
| `src/renderer/lib/stateCascade.ts` | NEW — `resolveElementAtState`. |
| `src/renderer/lib/generateCode.ts` | Emit pseudo-class blocks. Emit `customSelectorBlocks`. |
| `src/renderer/lib/parseCode.ts` | Route pseudo-class selectors → state overrides; unrecognised → `customSelectorBlocks`. |
| `src/renderer/store/canvasSlice.ts` | `activeStateName`, `setActiveState`. Extend patch routing. |
| `src/renderer/store/useResolvedElement.ts` | Honour `activeStateName`. Add `useStateOverrideFields`. |
| `src/renderer/src/components/StateSwitcher.tsx` | NEW |
| `src/renderer/src/components/StateSwitcher.module.css` | NEW |
| `src/renderer/src/components/PropertiesPanel.tsx` | Mount the switcher above the breakpoint switcher. |
| `src/renderer/src/components/sections/*.tsx` | Render inherited / overridden field treatment. Per-field reset button. |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Apply `activeStateName` overrides for selected elements; suppress transitions during preview. |
| `src/shared/agentMd.ts` | Document the convention in both `AGENT_MD_CONTENT` and `AGENT_MD_CONTENT_LEGACY`. |
| `test/elementStates.test.ts` | NEW — cascade unit tests. |
| `test/generateCodeStates.test.ts` | NEW — emit tests. |
| `test/parseCodeStates.test.ts` | NEW — parse tests. |
| `test/integration/stateRoundTrip.integration.test.ts` | NEW — full generate → write → parse round-trip with state overrides. |

---

## Open questions (please review)

**Q1. Are `position` / `x` / `y` excluded from the state override?**
I'd exclude them because hover layout shifts (changing `position` or
absolute coordinates on hover) are bad UX and lead to layout flicker.
Users who want a hover transform reach for `transform: translateY(...)`
which lives in `customProperties` and IS in the override. If you'd
rather include them for completeness — easy to flip; the type is
where the exclusion lives. - yes exclude position.

**Q2. Per-state transitions?**
Default position: a transition declared on the base applies to all
state changes (CSS native behaviour). I'd skip per-state transition
overrides for this story because it adds UX complexity (inheritance
visualisation gets messy on a list field) for a niche use case. Flag
as a follow-up if users ask. yes skip per state transitions.

**Q3. State × breakpoint matrix?**
Excluded for this story. A hover style is desktop-only. The data
model leaves a clean extension path (move `stateOverrides` into
`BreakpointOverride` later, or add a parallel
`breakpointStateOverrides`). My recommendation: ship desktop states,
revisit the matrix when a real user hits the limitation. yes just do desktop states for now.

**Q4. Canvas hover preview vs explicit toggle?** *(resolved)*
Neither — the state switcher itself is the preview. Selecting an
element and switching to Hover renders that element with hover
styles applied. No pointermove triggers, no eye lock toggle. Live
runtime preview (real hover events, animations) lands later as part
of preview mode (story #5).

**Q5. The `customSelectorBlocks` location**
Per-element here (matching the user-story note about preserving
unrecognised pseudo-classes attached to a class). The alternative is
page-level (sibling of `customMediaBlocks`). Per-element is closer
to where the data conceptually belongs — when an element is deleted
its raw blocks go with it — but page-level is simpler to thread
through the model. I'd go per-element. Open to swap if you'd rather. yes go with per-element

---

## Out of scope (recap)

- State × breakpoint combinations.
- `:focus-visible`, `:disabled`, `:checked`, `:nth-child` and other
  pseudo-classes — preserved verbatim, not modelled.
- Compound selectors (`.a:hover .b`, `.a:hover > .b`) — preserved
  verbatim via `customSelectorBlocks`.
- Real interactive hover/focus behaviour on the canvas frame.
- Per-state transitions (`transition: none` on hover).
- `position` / `x` / `y` per-state overrides (see Q1).
- `:has(...)`, `:not(...)`, attribute selectors.

---

## Risks

- **`StateOverride` field exclusions feel arbitrary.** Decisions
  about what's in vs out of the override are easy to second-guess
  later. Mitigation: document the exclusion rationale right next to
  the type definition (per the `BreakpointOverride` precedent).
- **Inherited-field UI treatment in sections.** Each section
  currently assumes one resolved value per field. Adding a "this
  came from default vs is overridden here" treatment is a one-line
  prop in the sections, but visualising it consistently across
  sliders, segmented controls, color pickers, and free-text fields
  is meaningful design work. Plan to land a single shared helper
  (`InheritedIndicator` or similar) so the treatment is uniform.
- **Parser ambiguity around pseudo-class escape hatch.** The parser
  must reliably distinguish `.rect_a1b2:hover` (recognised) from
  `.rect_a1b2:focus-visible` (raw block) from
  `.rect_a1b2:hover .child` (raw block — compound). A tight regex
  with explicit allowlist of the three recognised states keeps
  false positives out, but agent-written `.rect_a1b2 :hover` (note
  the space) is technically a descendant selector that we shouldn't
  parse as a state. Tests must cover these edge cases.
- **Patch routing complexity.** With three axes (base, breakpoint,
  state) the routing function gains a fourth combination case
  (state × breakpoint, currently rejected). Worth leaving a clear
  TODO comment so the future state×breakpoint phase has an obvious
  insertion point.
- **Round-trip stability with mixed state and customSelectorBlocks.**
  Order matters for CSS cascade. The generator must always emit
  recognised state blocks BEFORE `customSelectorBlocks` for a given
  element, so an agent who manually inserts a `.rect_a1b2:focus-visible`
  rule between hover and active doesn't get reordered out from
  under them. Round-trip test covers this.
