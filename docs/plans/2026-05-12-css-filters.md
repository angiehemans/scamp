# CSS Filters — Plan

**Status:** Draft for review.
**Date:** 2026-05-12
**Source:** `docs/backlog-4.md` story #4
**Related:** Box shadow (story #1, shipped — same "promote a
comma-separated CSS shorthand to a typed list, route through
`cssPropertyMap`, auto-cascade through state/breakpoint overrides"
pattern), Blend modes (story #2, shipped — same typed-enum approach
for the per-filter dropdown), Transitions (v1, shipped — original
template for `splitCssList` + `tokenizeShorthandSegment`).

---

## Goal

Promote `filter` and `backdrop-filter` from the `customProperties`
passthrough bag to first-class typed list fields on every element.
Each list holds an ordered series of filter functions
(`blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`,
`invert`, `opacity`, `saturate`, `sepia`). The generator emits a
single space-joined `filter:` / `backdrop-filter:` declaration; the
parser decomposes it back into typed rows so round-trips are clean.

The user gets WYSIWYG control over visual effects (blur, color
grading, contrast, etc.) without writing CSS; agent-written filter
values that don't reduce to our typed list continue to round-trip
through the file unchanged via `customProperties`.

---

## Current state — what we can build on

- **Box shadow** (just shipped, see
  `docs/plans/2026-05-06-box-shadow.md`). The closest analogue.
  Same template: a comma- or space-separated CSS shorthand parsed
  into a typed list, emitted back as one declaration, refusing
  cleanly to `customProperties` when any segment is irreducible.
- **`splitCssList`** (`src/renderer/lib/parsers.ts:224`) and
  **`tokenizeShorthandSegment`** (line 248) — both already exported
  and paren-aware. `splitCssList` isn't needed for `filter` because
  filter functions are space-separated, not comma-separated, but
  `tokenizeShorthandSegment` is exactly what we need to split a
  filter value into individual `fn(arg)` tokens while keeping each
  function call's parens intact.
- **`cssPropertyMap`** (`src/renderer/lib/cssPropertyMap.ts`). One
  place to route a CSS property — adding `'filter'` and
  `'backdrop-filter'` entries here makes the parser populate the
  new typed fields instead of `customProperties`.
- **Section primitives** (`Section`, `Row` in
  `src/renderer/src/components/sections/Section.tsx`,
  plus `SegmentedControl`, `NumberInput`, `Tooltip`). The
  `ShadowsSection.tsx` row pattern is a direct template — copy the
  add/remove/update row mechanics.
- **`FIELD_LABELS`** (`Section.tsx:275`). Adding `filters` and
  `backdropFilters` entries makes the override-indicator tooltip
  read `filter` / `backdrop-filter` instead of the camelCase
  field name.
- **Duplicate-declaration warning** (`useDuplicateIndicator` in
  `Section.tsx:161`). The story spec says `filter` and
  `backdrop-filter` are currently in `customProperties` "shown with
  a warning label". Today the parser only flags duplicate
  declarations (same property declared twice in one rule). I don't
  see a separate "this is a passthrough property" warning today;
  the backlog wording is forward-looking. **Confirmation needed**
  in open question #1 — do we need to add a passthrough warning
  surface as part of this story, or is the spec referring to a
  warning we already plan but haven't built? See open questions
  below.
- **Lossless contract** — agent-written
  `filter: url(#svg-filter)` or `filter: drop-shadow(...)` (we
  don't model `drop-shadow`) returns `null` from the mapper and
  falls through to `customProperties` byte-equivalent, same as
  box-shadow's `var()` case.

What's NOT there yet:

- No element-level fields for `filters` / `backdropFilters`.
- No `filter` or `backdrop-filter` entry in `cssToScampProperty` —
  both currently land in `customProperties`.
- No filter-function parser. The box-shadow tokenizer reuses the
  same shape (space-separated tokens with paren-aware function
  calls) but the segment semantics differ — see "Parsers" below.

---

## Non-goals for this story

- **`drop-shadow()` filter function.** Different from
  `box-shadow` (follows the alpha mask, not the box bounds) and
  needs its own four-parameter editor row. Out of scope; the
  parser refuses it and it round-trips via `customProperties`.
  Worth a follow-up after `box-shadow` + `filters` are both
  proven.
- **`url(#svg-filter)` reference to an inline / external SVG
  filter.** The author of this value needs the SVG too. Out of
  scope; mapper refuses → `customProperties` byte-equivalent
  round-trip.
- **CSS custom properties as filter args**
  (`blur(var(--blur-md))`). The numeric input doesn't model token
  references, and there's no design-token category for filter
  amounts yet. Mapper refuses on any non-numeric argument →
  `customProperties` round-trip. Could pair with a future
  "filter-amount tokens" theme category but that's its own story.
- **Drag-to-reorder rows.** The story explicitly notes that this
  "is the most complex UI in this story — consider building
  filter rows without drag-to-reorder first and adding reordering
  in a follow-up". Ship v1 with row reordering via
  "move up / move down" buttons (or simply remove + re-add at
  desired position, same affordance the box-shadow row uses).
  Drag-and-drop reorder is deferred to a single UX pass shared
  with the existing box-shadow deferred-reorder follow-up.
- **Per-row visibility toggle.** Same constraint the box-shadow
  story hit: the CSS file has no representation for "disabled but
  remembered", so a toggled-off row would lose its disabled state
  on save/reload. Defer to the shared follow-up alongside the
  box-shadow visibility toggle. See `docs/backlog-4.md`
  "Deferred follow-ups" — both shadow + filter share the same
  deferral note.
- **Filter presets** (`subtle-blur`, `dim`, …). Useful in concept
  but overlaps with the theme-tokens work — defer.
- **Backdrop-filter browser-support warning.** The story notes
  this but we're in Chromium — the canvas renders it fine and an
  exported page will work in any modern browser. A docs note is
  enough; no UI affordance for v1.

---

## Data model

### New types

```ts
// src/renderer/lib/element.ts

/**
 * One CSS filter function as a typed entry. The kind picks which
 * function name is emitted (`blur`, `brightness`, …) and the
 * argument is stored in its canonical unit per the spec:
 *
 * | kind        | unit | range  | example      |
 * |-------------|------|--------|--------------|
 * | blur        | px   | 0–100  | blur(8px)    |
 * | brightness  | %    | 0–200  | brightness(120%) |
 * | contrast    | %    | 0–200  | contrast(80%) |
 * | grayscale   | %    | 0–100  | grayscale(100%) |
 * | hue-rotate  | deg  | 0–360  | hue-rotate(90deg) |
 * | invert      | %    | 0–100  | invert(100%) |
 * | opacity     | %    | 0–100  | opacity(50%) |
 * | saturate    | %    | 0–200  | saturate(150%) |
 * | sepia       | %    | 0–100  | sepia(80%) |
 *
 * Ranges are UI-side clamps (sliders enforce them); the data
 * layer accepts any finite number so an agent-written value
 * outside the slider range round-trips without clipping. The
 * parser refuses non-numeric arguments (`var(...)`, `calc(...)`,
 * unitless decimals for percent-typed functions) — those land
 * in `customProperties` verbatim.
 */
export type FilterKind =
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'grayscale'
  | 'hue-rotate'
  | 'invert'
  | 'opacity'
  | 'saturate'
  | 'sepia';

export type FilterDef = {
  kind: FilterKind;
  /**
   * The numeric argument in the kind's canonical unit (px for
   * blur, deg for hue-rotate, percent for the rest). For percent
   * kinds the value is the percent number itself (100 means
   * `100%`, not 1.0) so the slider / number input renders the
   * value the user types directly.
   */
  value: number;
};
```

### Extended `ScampElement`

```ts
export type ScampElement = {
  // ... existing fields ...

  /**
   * Ordered list of CSS filter functions applied to the element.
   * Empty by default. Emitted as a single space-joined
   * `filter: f1(...) f2(...) f3(...)` declaration when non-empty.
   * Order matters — filters are applied in sequence and changing
   * the order changes the visual result. Agent-written `filter`
   * values containing functions outside `FilterKind`
   * (`drop-shadow`, `url(...)`, custom values) refuse from the
   * mapper and preserve verbatim in `customProperties`.
   */
  filters: ReadonlyArray<FilterDef>;

  /**
   * Same shape as `filters` but emitted as `backdrop-filter`.
   * Applies filter effects to the content behind the element
   * (visible only if the element has a partially transparent
   * background). Independent list — adding a blur to `filters`
   * doesn't touch `backdropFilters` and vice versa.
   */
  backdropFilters: ReadonlyArray<FilterDef>;
};
```

### Defaults

```ts
// src/renderer/lib/defaults.ts — DEFAULT_RECT_STYLES and
// DEFAULT_ROOT_STYLES both gain:

filters: [] as ReadonlyArray<FilterDef>,
backdropFilters: [] as ReadonlyArray<FilterDef>,
```

Empty-list defaults mean the generator's "only emit non-default"
rule omits both declarations when no filter is set. Existing files
stay byte-equivalent on the first save after the upgrade.

### Migration of existing files

Same model as box-shadow / blend-modes:

1. Files in the wild may carry `filter: ...` /
   `backdrop-filter: ...` in `customProperties` (today's bag).
   On the next parse the new mapper attempts to reduce the value
   to a typed list. If it succeeds, the typed list field is
   populated and the entry is stripped from `customProperties`.
2. If any segment refuses (unknown function, non-numeric arg),
   the whole value stays in `customProperties` and the typed
   list stays empty. No regression.
3. The generator never emits both — when the typed list is
   non-empty it emits the typed declaration, and the parser's
   invariant of "removed from `customProperties` on the way in"
   keeps things consistent.

### State / breakpoint overrides

Both fields are CSS-level lists, so they round-trip through
`BreakpointOverride` and `StateOverride` automatically — both
override types are generated via `Partial<Omit<ScampElement, …>>`,
so adding the fields to `ScampElement` opts them in. The override
emit / parse helpers walk `cssToScampProperty` keys generically.
No new wiring beyond the two cases in `breakpointOverrideLines`
described below.

---

## Parsers — `src/renderer/lib/parsers.ts`

### New helpers

```ts
/**
 * Parse a single filter function call (`blur(8px)`,
 * `brightness(120%)`, `hue-rotate(90deg)`) into a `FilterDef`.
 *
 * The segment must be exactly one balanced function call. The
 * function name is matched case-insensitively against the
 * `FilterKind` set; the argument inside the parens is parsed as
 * a number with the kind's canonical unit.
 *
 * Refuses (returns null) when:
 *   - the function name is not a known `FilterKind`
 *   - the argument is missing, empty, or has nested parens
 *     (`blur(var(--md))`, `brightness(calc(100% + 20%))`)
 *   - the unit doesn't match the kind (e.g. `blur(50%)` —
 *     blur requires a length, percent is invalid)
 *   - the numeric portion is unparseable
 *
 * Callers (the cssPropertyMap mapper) treat null as
 * "preserve verbatim in customProperties".
 */
export const parseFilterFunction = (
  segment: string
): FilterDef | null => { /* ... */ };

/**
 * Parse a full `filter` / `backdrop-filter` value (space-separated
 * list of function calls) into an ordered list of `FilterDef`s.
 *
 * `none`, an empty string, or whitespace returns []. If ANY
 * function fails to parse, the whole value returns `null` so the
 * caller can fall back to customProperties — partial parses
 * would silently drop user filters.
 *
 * The CSS spec permits `filter` to be either `none` or a
 * whitespace-separated list of function calls. There is no comma
 * separator between filters (unlike box-shadow). Tokenization
 * needs to respect parens so `rgba(...)` inside a hypothetical
 * `drop-shadow(0 4px 8px rgba(0,0,0,0.5))` doesn't get split —
 * reuse `tokenizeShorthandSegment` which is paren-aware.
 */
export const parseFilterList = (
  raw: string
): ReadonlyArray<FilterDef> | null => { /* ... */ };

/**
 * Inverse of `parseFilterList`. Empty list → empty string; the
 * caller decides whether to emit nothing or `filter: none`.
 *
 * Output format (one function per token, order preserved):
 *   blur(8px) brightness(120%) hue-rotate(90deg)
 *
 * Numeric formatting strips trailing zeros from decimals so
 * `8.00` becomes `8` and `120.0` becomes `120` — round-trip
 * stable with author-written values that use the same compact
 * form.
 */
export const formatFilterList = (
  filters: ReadonlyArray<FilterDef>
): string => { /* ... */ };
```

### Per-kind unit table

Lookup table — single source of truth used by both the parser
and the formatter:

```ts
const FILTER_UNITS: Record<FilterKind, 'px' | '%' | 'deg'> = {
  blur: 'px',
  brightness: '%',
  contrast: '%',
  grayscale: '%',
  'hue-rotate': 'deg',
  invert: '%',
  opacity: '%',
  saturate: '%',
  sepia: '%',
};
```

### Tokenization gotchas

- **Whitespace inside parens.** A modern `rgb()` syntax can
  contain spaces; if we ever extend to `drop-shadow` the arg
  string will too. `tokenizeShorthandSegment` already handles
  this by tracking paren depth. Reuse it.
- **Case-insensitive kind matching.** Author-written
  `BLUR(4px)` should parse. Lowercase the function name before
  the lookup; emit lowercase from `formatFilterList`.
- **Unitless `0` for blur.** CSS allows `blur(0)` without a
  unit because zero is unambiguous. Treat as `blur(0px)`. Don't
  expand the same exemption to other length-typed kinds — only
  blur is length-typed.
- **Decimal arguments.** `brightness(1.2)` is *not* the same as
  `brightness(120%)` in CSS (the former is a unitless number
  representing a multiplier, the latter is a percentage). We
  only model the percent form. A unitless decimal argument
  refuses to parse → falls through to `customProperties`.
  Same call for opacity, contrast, saturate. This is a
  deliberate narrowing — users authoring via the panel always
  get percent output, and round-trip-from-author values use
  whatever the author wrote.
- **`opacity()` collision with the `opacity` CSS property.** The
  filter function is `opacity(50%)` and the property is
  `opacity: 0.5`. These are different code paths; the property
  is already modeled (`element.opacity: number`), the filter is
  new and lives in the list. No collision in our code, but worth
  a tooltip on the Opacity filter row so users don't think
  they're editing the same thing as the property.

---

## Property map — `src/renderer/lib/cssPropertyMap.ts`

Two new mapper entries alongside the recent box-shadow / blend
entries (line ~225):

```ts
filter: (v) => {
  const parsed = parseFilterList(v);
  if (parsed === null) return null;
  return { filters: parsed };
},
'backdrop-filter': (v) => {
  const parsed = parseFilterList(v);
  if (parsed === null) return null;
  return { backdropFilters: parsed };
},
```

Both share the same parser. The mapper is the only place that
distinguishes which typed field receives the result.

The `none` / empty branches inside `parseFilterList` return `[]`
(not `null`). An explicit `filter: none` in a state or breakpoint
override should clear an inherited filter list, not fall through
to `customProperties`. The generator never emits `filter: none`
on the base rule (empty list = omit), but the override emit
branch does — see below.

---

## Code emission — `src/renderer/lib/generateCode.ts`

A new emit branch on the main rule body, slotting next to the
existing box-shadow / blend-mode block (around line 489):

```ts
// Filter list — single space-joined declaration per property.
// Empty list omits.
if (el.filters.length > 0) {
  lines.push(`filter: ${formatFilterList(el.filters)};`);
}
if (el.backdropFilters.length > 0) {
  lines.push(`backdrop-filter: ${formatFilterList(el.backdropFilters)};`);
}
```

For breakpoint and state overrides, the `breakpointOverrideLines`
helper that walks `cssToScampProperty` keys gains two cases
mirroring how `boxShadows` is handled today:

```ts
if (has('filters') && override.filters !== undefined) {
  if (override.filters.length === 0) {
    lines.push('filter: none;');
  } else {
    lines.push(`filter: ${formatFilterList(override.filters)};`);
  }
}
if (
  has('backdropFilters') &&
  override.backdropFilters !== undefined
) {
  if (override.backdropFilters.length === 0) {
    lines.push('backdrop-filter: none;');
  } else {
    lines.push(`backdrop-filter: ${formatFilterList(override.backdropFilters)};`);
  }
}
```

An empty override list at a non-default scope means "explicitly
clear the inherited filter list at this scope" — same pattern
used by transitions (`transition: none`) and shadows
(`box-shadow: none`).

---

## Canvas rendering — `src/renderer/src/canvas/ElementRenderer.tsx`

The browser handles `filter` and `backdrop-filter` natively. The
renderer's inline-style branch needs to mirror the typed fields
into `base.filter` / `base.backdropFilter` so the canvas matches
the file output. Slots next to the existing `boxShadow` /
`mixBlendMode` branches (around line 303):

```ts
if (el.filters.length > 0) {
  base.filter = formatFilterList(el.filters);
}
if (el.backdropFilters.length > 0) {
  base.backdropFilter = formatFilterList(el.backdropFilters);
}
```

No other canvas changes needed. `filter: blur()` on a parent
naturally cascades through children via the browser's rendering;
the surprising-for-Figma-users behaviour mentioned in the story
notes is the browser's, not ours.

---

## UI — `src/renderer/src/components/sections/FiltersSection.tsx`

A new section component, mounted from `UiPanel.tsx` next to
`ShadowsSection`. Mirrors `ShadowsSection.tsx` row mechanics.

### Section layout

```
┌─ Filters ───────────────────────────────── ┐
│  ┌──────────────────────────── [×] ──┐    │
│  │ Filter 1                           │    │
│  │ [ Blur ▾ ]  [   8   ] px           │    │
│  └────────────────────────────────────┘    │
│  ┌──────────────────────────── [×] ──┐    │
│  │ Filter 2                           │    │
│  │ [ Brightness ▾ ]  [  120  ] %      │    │
│  └────────────────────────────────────┘    │
│  [ + Add filter ]                          │
│  ─────────────────────────────────────     │
│  Backdrop filter   [ ⏻ ]                   │
│  (visible when toggled on)                 │
│  ┌──────────────────────────── [×] ──┐    │
│  │ Filter 1                           │    │
│  │ [ Blur ▾ ]  [  12   ] px           │    │
│  └────────────────────────────────────┘    │
│  [ + Add backdrop filter ]                 │
│  Hint: requires partially transparent      │
│  background to be visible.                 │
└────────────────────────────────────────────┘
```

Both `filters` and `backdropFilters` live in one `Filters` section
since they share the row UI. The Backdrop subsection appears
beneath a divider and is gated on a toggle (see "Backdrop toggle"
below).

Mounts in `UiPanel.tsx` between `ShadowsSection` and the next
section after it (likely transitions or animations — exact
placement depends on current order; matches the box-shadow plan's
pattern of mounting for every element type EXCEPT image. The
image element gets its own appearance section already).

### Row controls

| Control | Component | Notes |
|---|---|---|
| Kind dropdown | `EnumSelect<FilterKind>` (single source of truth in `src/renderer/lib/filterKinds.ts`) | 9 options, ordered same as the story spec table |
| Value input | `NumberInput` with `suffix` derived from the kind | Suffix is `px`, `%`, or `deg`. Switching kinds resets the value to that kind's default (see defaults table) |
| Remove | Existing `rowRemoveButton` × icon | Same as shadow row |

**Kind-switch behaviour.** When the user changes the kind
dropdown, reset the value to the kind's canonical default rather
than re-interpreting the old number under the new unit (e.g.
switching from `blur(50px)` to `brightness` should NOT result in
`brightness(50%)`). Story spec doesn't mandate either behaviour,
but "default per kind" matches Figma-style filter UIs and avoids
nonsense intermediate states like `hue-rotate(50px)` if the
user's mouse slips during a multi-pick interaction.

**Per-kind defaults** (used for both "+ Add filter" and
kind-switch reset):

```ts
const FILTER_DEFAULTS: Record<FilterKind, number> = {
  blur: 4,           // px — modest blur, visibly different from 0
  brightness: 100,   // % — no change
  contrast: 100,     // % — no change
  grayscale: 100,    // % — fully gray (gradual via slider drag)
  'hue-rotate': 0,   // deg — no change
  invert: 100,       // % — fully inverted
  opacity: 100,      // % — no change
  saturate: 100,     // % — no change
  sepia: 100,        // % — fully sepia
};
```

Rationale: kinds that meaningfully default to "off" (brightness,
contrast, hue-rotate, opacity, saturate) get their no-op value;
kinds where the user typically wants "full effect then dial back"
(grayscale, invert, sepia) get 100%; blur gets a modest 4px.

**Slider vs number-only.** The story spec calls for
`Slider + number (%)` controls. We already have `NumberInput`
but no slider control today. Two options:

- **Recommended for v1:** ship with `NumberInput` only (the
  number is the slider's value anyway, and dragging in the
  numeric field already supports value-drag via the existing
  input-drag behaviour). Adding a sibling slider can be a
  follow-up — it's a new component (`RangeSlider`) that's
  generally useful but isn't blocking the feature.
- **Alternative:** build `RangeSlider` as part of this story
  and use it alongside `NumberInput` like the box-shadow color
  / opacity row uses `ColorInput` + `NumberInput`. Bigger UI
  scope.

See open question #2 on which to ship.

### "+ Add filter" default

```ts
{ kind: 'blur', value: FILTER_DEFAULTS.blur } // → blur(4px)
```

First filter added is `blur(4px)` — visibly different from
"no filter" so the user can see something happen immediately.
Subsequent rows default to the same; the user picks a different
kind from the dropdown.

### Backdrop toggle

`backdrop-filter` deserves a separate sub-section because:

- The story spec calls it out as a separate control.
- The visibility hint ("requires partially transparent
  background") only applies to backdrop, not the main filter.
- Most users won't reach for it — gating it behind a toggle
  keeps the section visually compact for the common case.

Toggle button (`SegmentedControl` or a plain checkbox) labeled
"Backdrop filter". When off, the subsection collapses and the
typed array is empty. When the user adds a filter row, the toggle
implicitly flips on. When the user removes the last row, the
toggle stays on (so the hint stays visible and they can add
more) until they explicitly toggle off, at which point the array
clears.

Alternative: no toggle, just always-visible "+ Add backdrop
filter" button with the hint text inline. Simpler, less compact.
See open question #3.

### State / hover surfacing

Reads via `useResolvedElement(elementId)`, writes via
`patchElement`. Same pattern as `ShadowsSection`. The state-aware
middleware routes onto the right override axis automatically.

The section passes `fields={['filters', 'backdropFilters']}` to
`<Section>` so the override-indicator dot lights up when either
list has an active state / breakpoint override. The
`cssProperties` prop is `['filter', 'backdrop-filter']` for the
duplicate-declaration indicator.

### `FIELD_LABELS` additions

In `Section.tsx:275`:

```ts
filters: 'filter',
backdropFilters: 'backdrop-filter',
```

So the override-indicator tooltip lists the CSS property name
rather than the internal camelCase field name.

---

## Tests

All new tests live in `test/`. New files:

- `test/filterParser.test.ts` — `parseFilterFunction`,
  `parseFilterList`, `formatFilterList`.
- `test/filterGenerate.test.ts` — generator emit cases for the
  base rule and the override branches.
- `test/filterRoundTrip.test.ts` — `generateCode` → `parseCode`
  invariant across single, multi, hover-state, and breakpoint
  scoped filters.

Updates to existing files:

- `test/cssPropertyMap.test.ts` — `describe('filter', …)` and
  `describe('backdrop-filter', …)` blocks: each kind recognised,
  unknown function refused, unit mismatch refused,
  case-insensitive parsing.
- `test/agentLossless.test.ts` — assert
  `filter: drop-shadow(...)`, `filter: url(#svg)`,
  `filter: blur(var(--blur-md))`,
  `backdrop-filter: brightness(1.2)` (unitless decimal) all
  survive verbatim.
- `test/defaults.test.ts` — extend the `DEFAULT_RECT_STYLES`
  shape assertion to include the new fields.
- Element-construction test fixtures need `filters: []` and
  `backdropFilters: []` — same mechanical edit the box-shadow
  / blend-mode plans touched.

### Parser test cases

Mirror `boxShadowParser.test.ts` structure. At minimum:

```ts
describe('parseFilterFunction', () => {
  it('parses blur with px', () => { /* blur(8px) */ });
  it('parses blur with 0 (unitless allowed)', () => { /* blur(0) → 0px */ });
  it('parses brightness with %', () => { /* brightness(120%) */ });
  it('parses hue-rotate with deg', () => { /* hue-rotate(90deg) */ });
  it('parses kind case-insensitively', () => { /* BLUR(4px) */ });
  it('returns null for unknown function', () => { /* drop-shadow(...) */ });
  it('returns null for unit mismatch', () => { /* blur(50%) */ });
  it('returns null for unitless brightness decimal', () => { /* brightness(1.2) */ });
  it('returns null for nested parens (var/calc)', () => { /* blur(var(--md)) */ });
  it('returns null for empty input', () => { /* '' */ });
});

describe('parseFilterList', () => {
  it('returns [] for none', () => { /* 'none' → [] */ });
  it('returns [] for empty input', () => { /* '' → [] */ });
  it('parses a single filter', () => { /* one function */ });
  it('parses a multi-filter list', () => {
    /* 'blur(4px) brightness(120%) grayscale(20%)' → 3 entries */
  });
  it('preserves order across multiple filters', () => { /* … */ });
  it('returns null when ANY function fails', () => {
    /* 'blur(4px) drop-shadow(0 0 0)' → null (don't drop the good one) */
  });
});

describe('formatFilterList', () => {
  it('emits kind(value+unit) in order', () => { /* … */ });
  it('omits trailing-zero decimals', () => { /* 8.0 → 8 */ });
  it('joins multiple filters with a space', () => { /* … */ });
  it('returns empty string for an empty list', () => { /* … */ });
});
```

### Round-trip tests

The single most important test:

```ts
it('round-trips a multi-filter list with mixed kinds and units', () => {
  const elements = makeElementsWith({
    filters: [
      { kind: 'blur', value: 4 },
      { kind: 'brightness', value: 120 },
      { kind: 'hue-rotate', value: 45 },
      { kind: 'saturate', value: 80 },
    ],
    backdropFilters: [
      { kind: 'blur', value: 12 },
    ],
  });
  const { tsx, css } = generateCode(elements, ROOT_ID, 'home');
  const { elements: parsed } = parseCode(tsx, css);
  expect(parsed).toEqual(elements);
});
```

Plus existing tests update to verify:

- An element with empty `filters` and `backdropFilters`
  produces no declarations.
- `filter: none` at a breakpoint scope clears an inherited
  filter on parse and re-emits as `none` on generate.
- `filter: drop-shadow(0 4px 8px #000)` on the base element
  falls through to `customProperties['filter']` and round-trips
  byte-equivalent.

---

## Implementation order

Bottom-up, each step ships with passing tests before the next.
Same flow used for box-shadow and blend-modes.

1. **Types and defaults.** `FilterKind`, `FilterDef`,
   `filters` / `backdropFilters` on `ScampElement`,
   `filters: []` and `backdropFilters: []` on both
   `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES`. Update
   `cloneElementSubtree`'s defensive-copy block to clone both
   arrays. Update test fixtures (mechanical edit). Build passes;
   no runtime effect yet.

2. **Filter-kind constants module.**
   `src/renderer/lib/filterKinds.ts` exports
   `FILTER_KINDS` (ordered list for the dropdown),
   `FILTER_UNITS` (kind → unit), `FILTER_DEFAULTS` (kind →
   default numeric), `FILTER_RANGES` (kind → `{min, max}` for
   the slider clamp), and `isFilterKind` (type guard). Single
   source of truth shared by the parser, formatter, and UI.

3. **Parsers.** `parseFilterFunction`, `parseFilterList`,
   `formatFilterList` in `parsers.ts`. Tests in
   `test/filterParser.test.ts` written alongside.

4. **CSS property map.** Add the two mapper entries. Update
   `test/cssPropertyMap.test.ts` and `test/agentLossless.test.ts`.
   Files with `filter:` / `backdrop-filter:` declarations now
   route into the typed fields when reducible; otherwise stay
   in `customProperties` byte-equivalent.

5. **Generator.** Emit `filter:` / `backdrop-filter:` from the
   typed fields on the base rule and from the override branches.
   `test/filterGenerate.test.ts` and `test/filterRoundTrip.test.ts`
   pass.

6. **Canvas renderer.** Add the two inline-style branches in
   `ElementRenderer.tsx`. Hand-test in the canvas — add a filter
   row, verify the visible effect, then drop into `parseCode` /
   `generateCode` and confirm round-trip.

7. **Properties panel section.** `FiltersSection.tsx`, mounted
   from `UiPanel.tsx`. No new store wiring — `patchElement`
   handles the rest. Add `FIELD_LABELS` entries.

   Hand-test: add a filter, edit it, save the file, reopen — the
   row is back. Add a backdrop filter, drop it on `:hover` via
   the state switcher, save, reopen — the hover override is
   preserved.

8. **Polish.** Empty-state copy ("No filters. Click + to add
   one"), tooltips on each filter kind explaining what it does,
   tooltip on the Opacity-filter row clarifying that it's
   different from the Opacity property. Section default-collapse
   when both lists are empty; default-open when either is
   non-empty (matches transitions / shadows).

9. **Docs.** Update `agent.md` to mention `filter` and
   `backdrop-filter` as typed properties (matches the
   box-shadow / blend-mode updates). Existing wording about
   "anything Scamp doesn't model rounds-trips through your file
   unchanged" stays true — agent-written `filter: drop-shadow(...)`,
   `filter: url(#svg)`, etc., still round-trip via
   `customProperties`.

---

## Risks and edge cases

- **Unitless decimal ambiguity** (`brightness(1.2)` vs
  `brightness(120%)`). The CSS spec treats both as valid but
  semantically equivalent. We only model the percent form;
  decimal form refuses → `customProperties`. This means a
  file authored elsewhere with `filter: brightness(1.2)` shows
  up under "custom CSS" instead of the Filters section, even
  though it's the same effect. Mitigation: tooltip on the panel
  noting that filters are stored as percent; if the user wants
  panel control they can rewrite the value. Same trade as
  blend-modes' `plus-darker` refusal.
- **Filter ordering matters.** Unlike box-shadow where the
  "first one renders on top" semantics is well-known, filter
  ordering is more subtle:
  `blur(8px) brightness(120%)` ≠ `brightness(120%) blur(8px)`.
  Mitigation: when drag-to-reorder lands in the follow-up, add
  an inline note. For v1 the row order is the emit order, and
  the user can reorder by remove + re-add.
- **`opacity` filter vs `opacity` property collision.** Already
  covered above — tooltip on the row clears it up.
- **Backdrop-filter without a transparent background.** Visible
  in CSS but invisible on screen. UI hint covers it; the data
  model permits it freely.
- **Round-trip stability.** Our formatter strips trailing-zero
  decimals (`8.0` → `8`). Author files that use the verbose
  form (`8.0px`) will normalise to the compact form on save.
  Not byte-equivalent but semantically equivalent. Same trade
  the box-shadow plan made with spread-omission and
  currentColor-omission.
- **First-paint flicker after promotion.** Same as box-shadow:
  the property now renders via the CSS module rule rather than
  the renderer's inline `customPropsToStyle` route. Both routes
  resolve to the same computed style; no flicker, but the IPC
  sync writes into the CSS file rather than the inline style,
  which is the correct behaviour.

---

## Open questions for review

1. **Passthrough-property warning.** The backlog wording
   "currently stored in `customProperties` and shown with a
   warning label" implies a "this is a passthrough property"
   warning. I don't see that surface in today's code — only the
   duplicate-declaration indicator. Is this story responsible
   for adding that warning surface, or is the backlog describing
   a forward-looking warning we'll add later? My recommendation
   is to scope this story to typed promotion only and treat the
   "passthrough warning" as a separate cross-cutting story (it
   applies to every property the user might want promoted, not
   just `filter`). agree with your recommendation

2. **Slider control for percent-typed kinds.** Story spec calls
   for a slider + number combo. Ship v1 with `NumberInput` only
   (recommended), or build a `RangeSlider` control as part of
   this story? yeah number input is fine for now

3. **Backdrop filter toggle.** Gate behind a "Backdrop filter"
   toggle (recommended — keeps the common case compact), or
   always show the "+ Add backdrop filter" button inline below
   the main filter list? agreed

4. **Image element coverage.** The story says "every selected
   element". `ShadowsSection` excludes image elements (raw `<img>`
   `box-shadow` is unusual). For filters, image is actually one
   of the most common use cases (grayscale, brightness on
   photos). Recommendation: include `<img>` in the Filters
   section even though shadows excludes it. agreed

5. **`filter: inherit` / `initial` / `unset` / `revert`.** Treat
   as parser-refusal (fall through to `customProperties`) — same
   call box-shadow made. Confirm. agreed

6. **`drop-shadow` follow-up.** Should the spec include a
   tracked follow-up to add `drop-shadow(...)` support to the
   Filters section once shadows + filters are both stable? It's
   the missing tenth filter kind; users will ask. Recommendation:
   add to `docs/backlog-4.md` "Deferred follow-ups" if accepted. agreed
