# Transitions & CSS Grid — Implementation Plan

**Status:** Draft for review. Do not implement until approved.
**Date:** 2026-04-27
**Scope:** Backlog v3 stories 1 (Transitions) and 2 (CSS Grid layout).

---

## Goal

Two additive features on the WYSIWYG panel — both pure CSS so no canvas-rework is needed:

1. **Transitions.** A new "Transitions" section that emits a `transition` shorthand.
2. **CSS Grid.** Extend the Layout section's display toggle to Block / Flex / Grid, with grid-specific track + item controls and a dashed grid-line overlay on the canvas.

Doing them together because they share infrastructure (cssPropertyMap, generator, parser, breakpoint-override surface) and the test-harness work is amortized. They're independent at the data level — transitions don't touch layout, grid doesn't touch transitions — but both need `parseCode` extensions and both want round-trip integration tests.

Stories 3–6 in `backlog-3.md` are explicitly out of scope for this plan.

---

## Story 1 — Transitions

### Data model

```ts
// src/renderer/lib/element.ts
type TransitionDef = {
  /**
   * `'all'` or a CSS property name (`opacity`, `transform`, `background`,
   * `color`, `border`, `width`, `height`). We restrict to the dropdown
   * options at write time but the parser keeps any string the file has,
   * so agent-written transitions on (say) `box-shadow` round-trip.
   */
  property: string;
  durationMs: number;       // canonical ms; UI shows ms or s based on a unit toggle
  easing: TransitionEasing; // 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | string (cubic-bezier(...))
  delayMs: number;
};

// On ScampElement:
transitions: ReadonlyArray<TransitionDef>;
```

- `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES` get `transitions: []`.
- `BreakpointOverride` includes `transitions` so per-breakpoint overrides replace the whole list (semantically clean — a transition list is a single CSS declaration).
- Storing duration/delay in **canonical milliseconds** dodges unit-conversion bugs in generator/parser. The UI tracks the user's preferred unit per row in component-local state so they can toggle ms ↔ s without a stored field.

### Generator (`src/renderer/lib/generateCode.ts`)

- New helper `formatTransitionShorthand(transitions)` returning the comma-joined CSS.
- Emit only when `transitions.length > 0`. Default is empty list, omitted from output.
- Per-transition format: `<property> <duration> <easing> <delay>` with delay omitted when zero.
- Preserve user-typed cubic-bezier values verbatim through the easing field.

### Parser (`src/renderer/lib/parsers.ts` + `cssPropertyMap.ts`)

- New `parseTransitionShorthand(value: string): TransitionDef[]`.
- Split top-level commas (cubic-bezier has commas inside `()` — track paren depth).
- For each segment, parse tokens by type:
  - First time-value → `duration`. Second time-value → `delay`.
  - Keyword in the easing set or `cubic-bezier(...)` → `easing`.
  - Anything else → `property`.
- Add `transition` (and the longhands `transition-property`, `transition-duration`, `transition-timing-function`, `transition-delay`) to `cssPropertyMap.ts`. Longhands compose into the same `transitions` array; if both shorthand and longhand show up, the parser merges left-to-right.
- Unrecognised values (e.g. `cubic-bezier(0.4, 0, 0.2, 1.5)`) round-trip via `customProperties` only when the WHOLE shorthand fails to parse — partial-failure mode keeps the rest.

### UI

- New `src/renderer/src/components/sections/TransitionsSection.tsx`. Section title "Transitions". Renders one row per `TransitionDef` plus a `+ Add transition` button.
- Row controls (left to right):
  - Property — `EnumSelect`. Options: `all`, `opacity`, `transform`, `background`, `color`, `border`, `width`, `height`.
  - Duration — `NumberInput` paired with a small ms / s unit toggle (`SegmentedControl`). Editing the value writes canonical ms.
  - Easing — `EnumSelect`. Options: `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`, `Custom…`.
  - Delay — same shape as duration.
  - Remove — `×` button.
- Picking `Custom…` from the easing dropdown reveals an inline text input that writes the raw `cubic-bezier(a, b, c, d)` expression. No 4-point graphical editor in this plan — too much UI surface. Tracked as a follow-up if anyone asks.
- Wired into `UiPanel.tsx` for every element type (rect, text, image, input). The section is collapsible and starts collapsed because most elements don't have transitions.

### Tests

- **Unit (Vitest):**
  - `test/transitionParser.test.ts` — parsing edge cases: shorthand, longhand, multi-transition, with/without delay, cubic-bezier, malformed input.
  - `test/transitions.test.ts` — generator emits expected shorthand; round-trip via `generateCode → parseCode` returns the same array.
  - Update `test/cssPropertyMap.test.ts` for the new mappings.
- **E2E (Playwright):**
  - `test/e2e/properties-panel/transitions.spec.ts` — add a transition, change duration / easing, add a second transition, remove one, assert the CSS file contents.

### Breakpoint behavior

- A non-desktop edit replaces the entire `transitions` array at that breakpoint (matching how `padding` and other tuple/array fields work today).
- Section override-dot reuses the existing `Section` `fields` plumbing — pass `['transitions']`.

### Accepted compromises

- No graphical cubic-bezier editor — the text expression covers the use case and avoids inventing a new control.
- Property dropdown is fixed to the 8 options in the spec. Custom property names round-trip on read but the user picks one of the 8 from the UI.

---

## Story 2 — CSS Grid

### Data model

The existing flex fields stay put. Grid gets its own additive set so we don't disturb the flex code paths or invent a forced shared semantics.

```ts
// New, on ScampElement:
display: 'none' | 'flex' | 'grid';   // extend existing enum
gridTemplateColumns: string;          // free text, default ''
gridTemplateRows: string;             // free text, default ''
columnGap: number;                    // px, default 0
rowGap: number;                       // px, default 0
justifyItems: GridSelfAlign;          // 'start' | 'center' | 'end' | 'stretch', default 'stretch'

// Grid-item fields (apply when this element's PARENT is a grid):
gridColumn: string;                   // free text, default ''
gridRow: string;                      // free text, default ''
alignSelf: GridSelfAlign;             // default 'stretch'
justifySelf: GridSelfAlign;           // default 'stretch'
```

- `align-items` reuses the existing `alignItems` field; CSS accepts the flex spelling (`flex-start`/`flex-end`) on grid containers so we don't fork it. The Layout panel's enum copy changes per display mode (`Start/Center/End/Stretch` for grid) but the stored values stay the existing flex-spelling. Generator emits whatever's in the field.
- `column-gap` and `row-gap` are separate fields rather than reusing the flex `gap`. CSS allows `gap: row column`, but the spec for this story explicitly asks for two separate inputs and round-trips cleanly to two separate properties.
- All new fields are added to `BreakpointOverride` for breakpoint coverage.
- Defaults updated in both `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES`.

### Generator

- When `display === 'grid'`:
  - Always emit `display: grid;`
  - Emit `grid-template-columns`, `grid-template-rows` only when non-empty.
  - Emit `column-gap`, `row-gap` only when > 0.
  - Emit `justify-items` only when not the default `stretch`.
  - Emit `align-items` (existing logic, reused).
- For grid items (parent is grid):
  - Emit `grid-column`, `grid-row` only when non-empty.
  - Emit `align-self`, `justify-self` only when not `stretch`.
- Existing flex emission untouched. A `display: grid` element with leftover `gap`/`flex-direction`/etc. values doesn't emit them — the generator gates each by display mode.

### Parser (`cssPropertyMap.ts`)

- New entries: `display` (extend existing handler to recognise `grid`), `grid-template-columns`, `grid-template-rows`, `column-gap`, `row-gap`, `justify-items`, `grid-column`, `grid-row`, `align-self`, `justify-self`.
- Track template strings as raw text — no attempt to canonicalise `repeat(3, 1fr)` vs `1fr 1fr 1fr`.

### UI

#### `LayoutSection.tsx`

- The Block / Flex toggle becomes a 3-way `SegmentedControl`: Block / Flex / Grid (mapping to `none` / `flex` / `grid`).
- `display === 'grid'` swaps the flex-only controls for:
  - **Columns** — `PrefixSuffixInput` with prefix `Cols`, free-text. `placeholder="1fr 1fr"`.
  - **Rows** — `PrefixSuffixInput` with prefix `Rows`, free-text.
  - **Column gap** — `NumberInput` with prefix `C-gap`.
  - **Row gap** — `NumberInput` with prefix `R-gap`.
  - **Align items** — `SegmentedControl` Start / Center / End / Stretch.
  - **Justify items** — `SegmentedControl` Start / Center / End / Stretch.
- Section's override-dot fields list extends to include the new grid fields.

#### `SizeSection.tsx`

- When the selected element's parent is a grid container (resolved via the cascade hook), append:
  - **Column span / start** — `PrefixSuffixInput` prefix `Col`.
  - **Row span / start** — `PrefixSuffixInput` prefix `Row`.
  - **Align self** — `SegmentedControl`.
  - **Justify self** — `SegmentedControl`.
- These are conditional on parent display, mirroring how `PositionSection` already conditionally renders based on parent flex.

#### Canvas overlay

- New `src/renderer/src/canvas/GridOverlay.tsx`.
- Renders dashed lines for the selected element's grid tracks.
- Approach: `useLayoutEffect` reads `getComputedStyle(el).gridTemplateColumns` (browsers return resolved pixel values like `"100px 200px 100px"`) and `gridTemplateRows`. Walk the cumulative track sizes, render absolutely-positioned 1px dashed divs at each interior line. Re-measure on `elements` change + `ResizeObserver`.
- Mounted by `CanvasInteractionLayer.tsx` only when `isSingleSelection && elements[selectedId].display === 'grid'`. No overlay for non-grid selections — keeps the implementation scoped.

### Tests

- **Unit (Vitest):**
  - `test/gridProperties.test.ts` — generator emits expected declarations across grid/flex/none; round-trip; default-omission.
  - Update `test/cssPropertyMap.test.ts` for the new mappings.
  - Update `test/defaults.test.ts` for the new defaults.
- **E2E (Playwright):**
  - `test/e2e/properties-panel/grid-layout.spec.ts` — toggle to Grid, set `1fr 1fr` columns, verify CSS emits `display: grid`, `grid-template-columns: 1fr 1fr`, two children stack horizontally.
  - `test/e2e/properties-panel/grid-child.spec.ts` — child of a grid container; set `grid-column: span 2`; verify the child's CSS class block contains it.
  - Optional: an overlay smoke test asserting the overlay element renders when a grid container is selected. Skip if it's flaky — visual correctness is best validated by hand.

### Breakpoint behavior

- All new fields included in `BreakpointOverride`.
- `display` itself is per-breakpoint (already is — we're just extending the enum).
- Override-dot in Layout/Size sections reflects grid fields naturally via the existing `fields` array.

### Accepted compromises

- Free-text inputs for `grid-template-columns` / `grid-template-rows` and `grid-column` / `grid-row`. No visual track builder. Matches the story's note about power users wanting `minmax`/`auto-fill`.
- Grid line overlay uses computed-style sampling rather than the (more accurate but more complex) `el.computedStyleMap()` resolved-value introspection or `IntersectionObserver` per cell. Computed-style strings are widely supported in Chromium and resolve to absolute pixel sizes; that's what we need.

---

## Order of work

1. **Story 1** first — smaller surface area, validates the parser-extension pattern we'll reuse for Story 2.
   - Day 1: data model + generator + parser + unit tests.
   - Day 2: TransitionsSection UI + UiPanel wiring + E2E spec.
2. **Story 2** second — bigger but no dependency on transitions.
   - Day 3: data model + generator + parser + unit tests.
   - Day 4: LayoutSection / SizeSection updates + GridOverlay + E2E specs.

Each story lands as one PR with the unit tests, integration tests, and E2E specs that prove it works.

---

## Risks & open questions

1. **Transition shorthand parser ambiguity.** The CSS spec lets values appear in any order within a single transition expression, but distinguishing a 0.5s duration from a 0.5s delay relies on positional rules (first time-value = duration, second = delay). Mitigation: dedicated test file with the canonical ambiguous cases.
2. **`align-items` keyword spelling.** Storing `flex-start` and emitting it on a grid container works (CSS accepts it), but the panel will display "Start" — keeping the UX consistent across flex/grid even though the stored token is flex-flavoured. If this feels wrong, the alternative is canonicalising to `start`/`end` storage and migrating existing files (a parser-level change). I'd defer that migration.
3. **Grid overlay accuracy.** `getComputedStyle.gridTemplateColumns` returns the resolved track sizes — but only after layout has settled. The first paint after toggling display to grid might briefly show the overlay at zero. Mitigation: `ResizeObserver` + `useLayoutEffect` recompute on every layout change; flicker is at most one frame.
4. **`gap` vs `column-gap`/`row-gap`.** Grid containers use the new fields; flex containers keep using `gap`. If a user toggles a flex container with `gap: 16` to grid, the flex `gap` is no longer emitted but `columnGap`/`rowGap` start at 0. Toggling back restores the flex gap. Acceptable — CSS values reset on display-mode change is intuitive — but worth documenting in the section's tooltip if it surprises anyone in testing.
5. **Cubic-bezier input.** Decided: text-only field for the custom value. Open question: do we lint the input shape (4 numbers, parens) or accept anything? I'd accept anything — the parser already round-trips unknown easings, and validation is mostly a usability feature, not a correctness one.

---

## Questions for review before implementation starts

1. **Order:** Story 1 then Story 2 in two PRs as described. OK? yes
2. **Cubic-bezier UI:** punt the 4-point editor to a follow-up, ship a text input now. OK? yes but make a plan file for this.
3. **Grid `align-items` storage:** keep the existing `flex-start`/`flex-end` strings (works on grid in modern CSS, but is technically the flex spelling). OK or do you want canonical `start`/`end` everywhere with a migration? as long as the css output works
4. **Grid overlay:** ship the dashed line overlay as part of Story 2, or ship grid-without-overlay first and add the overlay as a follow-up? ship as part of story 2.
5. **`gap` divergence:** flex keeps `gap`, grid uses separate `columnGap`/`rowGap`. OK or unify on the latter (would require migration)? if a user switched the layout from flex to grid we should change the ui to have column gap and row gap, and take the value from the rpevious gap if we can, the most important thing is that the ui controls match css properite as close as possible.
