# Box Shadow — Plan

**Status:** Draft for review.
**Date:** 2026-05-06
**Source:** `docs/backlog-4.md` story #1
**Related:** Transitions (story #1 in v1, done — same shorthand-list
parsing pattern), Animations (story #4 in v3, done — same pattern of
"promote a `customProperties` value to a typed field"), per-element
states (story #3 in v2, done — `box-shadow` will need to honor
`stateOverrides` and `breakpointOverrides`).

---

## Goal

Promote `box-shadow` from the `customProperties` passthrough bag to a
first-class typed field on every element, with a WYSIWYG section that
lets users add, edit, and remove multiple shadows. The generator emits
a single comma-separated `box-shadow` declaration; the parser
decomposes it back into typed rows so round-trips are clean.

The user gets depth/elevation control without writing CSS;
agent-written shadows on `box-shadow`-supporting properties continue
to round-trip through the file unchanged.

---

## Current state — what we can build on

- **Transitions** (`element.transitions`,
  `parseTransitionShorthand`, `formatTransitionShorthand`,
  `splitCssList` in `src/renderer/lib/parsers.ts`,
  `TransitionsSection.tsx`). Same shape of problem: a CSS shorthand
  that is a comma-separated list of structured tokens, parsed into a
  typed array, emitted back as a single declaration. Reuse
  `splitCssList` directly.
- **`cssPropertyMap`** (`src/renderer/lib/cssPropertyMap.ts`). The
  one-place-to-route-a-CSS-property contract — adding `box-shadow`
  here makes the parser route it into the typed field instead of
  `customProperties`.
- **Section component pattern** (`Section`, `Row`, `DualField` in
  `src/renderer/src/components/sections/Section.tsx`). All sections
  share these primitives; the new `ShadowsSection` slots in next to
  `TransitionsSection`.
- **`ColorInput`** (`src/renderer/src/components/controls/ColorInput.tsx`)
  already supports hex, rgba, and `var()` token references with
  opacity — exactly what the shadow color control needs.
- **Lossless contract** (parser → mapper → `customProperties`). If a
  shadow value contains anything we can't reduce — `var(--shadow-md)`
  on the whole declaration, an unknown unit, a `calc(...)` offset —
  the entry returns `null` from the mapper and the whole declaration
  is preserved verbatim in `customProperties`. No silent drops.

What's NOT there yet:

- No element-level field for `boxShadows`.
- No `box-shadow` entry in `cssToScampProperty`. The property
  currently lands in `customProperties` and renders via
  `customPropsToStyle` (kebab → camel).
- No tests for parsing the shadow shorthand.

---

## Non-goals for this story

- **Drop shadow / `filter: drop-shadow()`.** Different CSS property,
  different visual semantics (follows alpha mask, not box). Out of
  scope; will be picked up by story #4 (CSS filters).
- **Text shadow.** Different property (`text-shadow`), different
  panel placement. Not part of this story.
- **Reorderable rows via drag-and-drop.** First shadow renders on
  top, so order matters, but the v1 ships with row-add at the end
  and "move up / move down" buttons (or simply remove + re-add at
  desired position). Drag-and-drop reordering can land in a
  follow-up — story #4 (filters) calls out the same pattern and
  groups them together for a single drag UX pass.
- **Persisted "row visibility toggle"** (story spec calls for one).
  The CSS file has no notion of a disabled-but-remembered shadow,
  so a disabled row won't survive a save/reload through the
  bidirectional sync. See "Open question — visibility toggle" below
  for the recommendation.
- **Multi-shadow `transition: box-shadow`.** Already works today
  via the existing transitions section — `box-shadow` is a free-form
  property string in `TransitionDef`. No change needed.
- **Shadow presets / a curated library** (`shadow-sm`, `shadow-md`,
  …). Would be useful but overlaps with the project-themes-css-tokens
  work (`var(--shadow-md)`); deferring lets us re-use the token
  picker rather than ship a parallel preset list.

---

## Data model

### New types

```ts
// src/renderer/lib/element.ts

/**
 * One box-shadow applied to an element. Stored as typed fields so
 * the panel can render proper controls; serialised back into the
 * `box-shadow` shorthand on emit. Multiple shadows on one element
 * become a comma-separated list, in the order stored here.
 *
 * `inset` flips the shadow from outside the box (default) to
 * inside. The CSS spec allows `inset` either before or after the
 * lengths/color; the generator always emits it leading
 * (`inset 0 4px 8px ...`) for consistency.
 *
 * `color` is a free-form string at the data layer so token refs
 * (`var(--shadow-color)`), `currentColor`, named colors, and
 * `rgba(...)` round-trip cleanly. The panel surfaces a ColorInput
 * for the common case.
 */
export type BoxShadowDef = {
  offsetX: number;   // px
  offsetY: number;   // px
  blur: number;      // px (>= 0)
  spread: number;    // px (can be negative)
  color: string;     // free-form CSS color
  inset: boolean;
};
```

### Extended `ScampElement`

```ts
export type ScampElement = {
  // ... existing fields ...

  /**
   * Ordered list of box shadows applied to the element. Empty by
   * default. Emitted as a single `box-shadow: a, b, c` declaration
   * when non-empty. Order matters — the first entry is rendered
   * on top of the rest. Agent-written `box-shadow` values that
   * the parser can't reduce (e.g. `var(--shadow-lg)` on the whole
   * declaration) are preserved verbatim in `customProperties` and
   * leave this list empty.
   */
  boxShadows: ReadonlyArray<BoxShadowDef>;
};
```

### Defaults

```ts
// src/renderer/lib/defaults.ts — DEFAULT_RECT_STYLES and
// DEFAULT_ROOT_STYLES both gain:

boxShadows: [] as ReadonlyArray<BoxShadowDef>,
```

The empty-list default means the generator's "only emit non-default"
rule omits the declaration entirely when no shadow is set, keeping
existing files byte-equivalent on the first save after the upgrade.

### Migration of existing files

Files in the wild may already have a `box-shadow` value in their
CSS module that the previous parser dropped into
`customProperties['box-shadow']`. After this change, a fresh parse
will route those values into `boxShadows` — but only for shadows
the new parser can model.

To make the migration painless:

1. The parser reads `box-shadow` via the new mapper. If the value
   reduces cleanly into `BoxShadowDef[]`, it lands in `boxShadows`
   and is removed from `customProperties`.
2. If the mapper returns `null` (unsupported value — e.g. just
   `var(--shadow-md)`), the value stays in `customProperties` and
   `boxShadows` stays empty. No regression.
3. The generator never emits both — when `boxShadows.length > 0` it
   emits the typed declaration, and the absence of any
   `customProperties['box-shadow']` entry is the parser's invariant
   (the parser strips it on the way in).

This matches how transitions and animations migrated when they
shipped: the old `customProperties.transition` /
`customProperties.animation` entries got promoted on the first
re-save without churn.

### State / breakpoint overrides

`boxShadows` is a CSS-level field, so it should round-trip through
both `BreakpointOverride` and `StateOverride`. Both types are
generated via `Partial<Omit<ScampElement, …>>`, so adding the field
to `ScampElement` automatically opts it in. No new code needed in
the override types.

The override emit / parse helpers route every mapped CSS field
generically through `cssToScampProperty` — adding `box-shadow`
there makes per-state and per-breakpoint shadows work for free.
There's a verification test in the test plan for this.

---

## Parsers — `src/renderer/lib/parsers.ts`

### New helpers

```ts
/**
 * Parse a single box-shadow segment into a `BoxShadowDef`.
 *
 * Per the CSS spec, a segment is:
 *   `[ inset? && <length>{2,4} && <color>? ]`
 *
 * - 2 lengths: offsetX, offsetY (blur and spread default to 0)
 * - 3 lengths: offsetX, offsetY, blur (spread defaults to 0)
 * - 4 lengths: offsetX, offsetY, blur, spread
 * - `inset` may appear before or after the lengths/color
 * - color is optional (defaults to `currentColor`); may appear
 *   before or after the lengths
 *
 * Returns `null` for inputs we can't reduce: missing offsets, a
 * length expressed as `calc(...)` or a token, an unknown trailing
 * token, etc. Callers (the cssPropertyMap mapper) treat null as
 * "preserve verbatim in customProperties".
 */
export const parseBoxShadowSegment = (
  segment: string
): BoxShadowDef | null => { /* ... */ };

/**
 * Parse a `box-shadow` shorthand value (single or comma-separated
 * list) into an ordered list of `BoxShadowDef`s. Empty input or
 * `none` returns []. If ANY segment fails to parse, the whole
 * value returns `null` so the caller can fall back to
 * customProperties — partial parses would silently drop user
 * shadows on save.
 */
export const parseBoxShadowShorthand = (
  raw: string
): ReadonlyArray<BoxShadowDef> | null => { /* ... */ };

/**
 * Inverse of `parseBoxShadowShorthand`. Empty list → empty string;
 * the caller decides whether to emit nothing or `box-shadow: none`.
 *
 * Output format (one shadow per segment, order preserved):
 *   [`inset` ]<x>px <y>px <blur>px <spread>px <color>
 *
 * Spread is omitted when 0 (matches the "minimal CSS" convention
 * users will recognise). Blur is always emitted so the column-
 * positions of x/y vs blur are visually consistent across rows.
 */
export const formatBoxShadowShorthand = (
  shadows: ReadonlyArray<BoxShadowDef>
): string => { /* ... */ };
```

### Tokenization gotchas

- Colors with parentheses (`rgba(0, 0, 0, 0.15)`, `hsl(0 0% 0% / 0.15)`)
  contain commas inside parens. **Use `splitCssList`** (already
  exported) to split on top-level commas — exactly what the
  transition parser uses. Reuse, don't reimplement.
- Tokenizing a single segment also needs paren-awareness (a color
  function is one token even though it contains spaces in some
  modern syntaxes). Reuse `tokenizeTransitionSegment` if it can be
  made shared, or copy its loop into a local helper. Prefer
  promoting `tokenizeTransitionSegment` to a shared
  `tokenizeShorthandSegment` exported from `parsers.ts`.
- The `inset` keyword is recognised case-insensitively and
  consumed (it's a fixed bool flag).
- Lengths use `parsePxOrNull` — a refusable variant — so
  `calc(10px + 2vw)` returns null and the segment fails; the whole
  value falls through to `customProperties`.
- Colors are detected as "the leftover non-length, non-`inset`
  token" — we don't validate the color string beyond non-empty,
  matching how `borderColor` and `backgroundColor` are handled
  elsewhere. The ColorInput control normalises display.

---

## Property map — `src/renderer/lib/cssPropertyMap.ts`

```ts
'box-shadow': (v) => {
  const parsed = parseBoxShadowShorthand(v);
  if (parsed === null) return null;
  return { boxShadows: parsed };
},
```

That's the entire wiring. The parser's existing baseline-then-overlay
machinery in `parseCode.ts` picks up the field and the generator
(below) emits it.

The `none` and empty-string branches inside
`parseBoxShadowShorthand` return `[]` (not `null`) — `box-shadow: none`
on the page should clear the field, not fall through to
`customProperties`. The generator never emits `box-shadow: none`
gratuitously (empty list = no declaration), but a state or
breakpoint override may emit `box-shadow: none` to explicitly clear
an inherited shadow. This is the same pattern transitions uses:
`transition: none` at a breakpoint scope clears the inherited
transition list.

---

## Code emission — `src/renderer/lib/generateCode.ts`

A new emit branch alongside the existing transitions / animation
blocks. Slots in around the same area (line ~476):

```ts
// Box shadows — single shorthand per element. Empty list omits.
if (el.boxShadows.length > 0) {
  lines.push(`box-shadow: ${formatBoxShadowShorthand(el.boxShadows)};`);
}
```

For breakpoint and state overrides, the `breakpointOverrideLines`
helper that walks `cssToScampProperty` keys gains a `boxShadows`
case, mirroring how `transitions` is handled today (~line 674):

```ts
if (has('boxShadows') && override.boxShadows !== undefined) {
  if (override.boxShadows.length === 0) {
    lines.push('box-shadow: none;');
  } else {
    lines.push(`box-shadow: ${formatBoxShadowShorthand(override.boxShadows)};`);
  }
}
```

`box-shadow: none` is the explicit clear; an empty override list at
breakpoint or state scope means "explicitly remove the inherited
shadow at this scope".

---

## UI — `src/renderer/src/components/sections/ShadowsSection.tsx`

A new section component, mounted from `UiPanel.tsx` next to
`TransitionsSection`. Closely mirrors the transitions section's
structure (each row has its own `<TransitionRow>`-like component).

### Section layout

```
┌─ Shadow ─────────────────────────────── [+] ┐
│  ┌──────────────────────────────── [×] ──┐ │
│  │ ▣ inset                              │ │
│  │ X [   0 ] px   Y [   4 ] px          │ │
│  │ Blur [ 8 ] px  Spread [   0 ] px     │ │
│  │ Color [▣] rgba(0,0,0,0.15)           │ │
│  └────────────────────────────────────────┘ │
│  ┌──────────────────────────────── [×] ──┐ │
│  │ ...                                    │ │
│  └────────────────────────────────────────┘ │
│  [ + Add shadow ]                           │
└─────────────────────────────────────────────┘
```

Mounts in `UiPanel.tsx` for every element type EXCEPT image (image
already has its own appearance section and `box-shadow` on a raw
img element is unusual — punt to v2 if a user asks). Hidden from
the root element only if the existing pattern excludes it; root is
included by default per the story spec.

### Row controls

| Control       | Component                                             | Notes                                                                                                                           |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Inset toggle  | `SegmentedControl` (Off/Inset) or a small `Tooltip` + checkbox icon | Story spec calls for a "subtle inset icon on the row" — render a small ◧/◨ icon next to the row title when inset is on        |
| X offset      | `NumberInput` with `prefix="X"` and `suffix="px"`     | Negative values allowed                                                                                                          |
| Y offset      | `NumberInput` with `prefix="Y"` and `suffix="px"`     | Negative values allowed                                                                                                          |
| Blur          | `NumberInput` with `prefix="Blur"` and `suffix="px"`  | `min={0}`                                                                                                                        |
| Spread        | `NumberInput` with `prefix="Spread"` and `suffix="px"` | Negative values allowed (insets the shadow)                                                                                     |
| Color         | `ColorInput`                                          | Already supports hex, rgba (with opacity slider), and `var()` token refs — story's "color picker + hex + opacity" comes for free |
| Remove        | Existing `rowRemoveButton` × icon                     | Same as transitions row                                                                                                         |

The "+ Add shadow" button at the section bottom appends a row with
defaults from the story:

```ts
{ offsetX: 0, offsetY: 4, blur: 8, spread: 0,
  color: 'rgba(0, 0, 0, 0.15)', inset: false }
```

### State / hover surfacing

The section reads its values via `useResolvedElement(elementId)` so
the rows reflect the active state (Default / Hover / Active /
Focus). Edits write through `patchElement`, which the existing
state-aware patching middleware routes onto the right axis. Same
pattern as TransitionsSection — no new wiring needed.

When the resolved element's shadows differ from the base because
of a state override, the existing `Section` "this state has an
override" badge (already used for other CSS fields via the
`fields` prop) lights up. We pass `fields={['boxShadows']}` for
this.

### Open question — visibility toggle

The story spec asks for a per-row visibility toggle. I recommend
**deferring this** for v1, with a follow-up issue, because:

- The CSS file has no representation for "this shadow is disabled
  but remembered" — toggling off would require either dropping the
  row from the file (loses state on save/reload) or smuggling
  state into a CSS comment / a private custom property.
- The user's existing remove button covers the same affordance
  (remove + re-add). The cost of remove/re-add is minor —
  comparable to the existing transitions / animation sections,
  neither of which has a visibility toggle.
- A clean implementation likely needs a separate "session-only UI
  state" mechanism that lives outside the elements model. Worth
  building once for shadows + filters together, not bolted on.

If the user wants the toggle in v1, the smallest implementation:
component-local React state keyed by row index, with a "•/○"
toggle button. The disabled rows skip the typed array entirely
during emit — same as if the user had removed them. **Disabled
state is lost on save/reload.** Surface a tooltip explaining this.


---

## Tests

All new tests live in `test/`. New files:

- `test/boxShadowParser.test.ts` — the new helpers in `parsers.ts`.
- `test/boxShadowGenerate.test.ts` — generator emit cases.
- `test/boxShadowRoundTrip.test.ts` — `generateCode` →
  `parseCode` invariant.

Updates to existing files:

- `test/cssPropertyMap.test.ts` — `describe('box-shadow', …)` block
  with the same shape as the existing `border` and `padding`
  describe blocks.
- `test/parseCode.test.ts` (or wherever the lossless test lives) —
  add a case asserting `box-shadow: var(--shadow-md)` falls
  through to `customProperties` because the value isn't reducible.
- `test/agentLossless.test.ts` — confirm the lossless contract for
  unsupported shadow values (one-off declarations, `calc(...)`
  offsets, etc.).

### Parser test cases

Mirror the structure of `transitionParser.test.ts`. At minimum:

```ts
describe('parseBoxShadowSegment', () => {
  it('parses 4 lengths + rgba color', () => { /* 0 4px 8px 0 rgba(0,0,0,0.15) */ });
  it('parses 2 lengths (offsets only) — blur and spread default to 0', () => { /* 4px 4px */ });
  it('parses 3 lengths — spread defaults to 0', () => { /* 0 4px 8px */ });
  it('parses leading inset', () => { /* inset 0 4px 8px rgba(...) */ });
  it('parses trailing inset', () => { /* 0 4px 8px rgba(...) inset */ });
  it('parses negative offsets', () => { /* -4px -4px 8px */ });
  it('parses negative spread', () => { /* 0 4px 8px -2px */ });
  it('parses hex color first', () => { /* #000 0 4px 8px */ });
  it('parses hex color last', () => { /* 0 4px 8px #000 */ });
  it('omits color → defaults to currentColor', () => { /* 0 4px 8px */ });
  it('returns null for calc() offset', () => { /* 0 calc(...) 8px */ });
  it('returns null for token-only shadow', () => { /* var(--shadow-md) */ });
  it('returns null for empty input', () => { /* '' */ });
});

describe('parseBoxShadowShorthand', () => {
  it('returns [] for none', () => { /* 'none' → [] */ });
  it('returns [] for empty input', () => { /* '' → [] */ });
  it('parses a single shadow', () => { /* one segment */ });
  it('parses a multi-shadow list', () => {
    /* '0 4px 8px 0 rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.08)' → 2 entries */
  });
  it('preserves order across multiple shadows', () => { /* … */ });
  it('preserves rgba commas inside parens', () => { /* hsl()/rgba() */ });
  it('returns null when ANY segment fails', () => {
    /* '0 4px 8px 0 #000, var(--bad)' → null (don't drop the good one) */
  });
});

describe('formatBoxShadowShorthand', () => {
  it('emits offsets + blur + spread + color in order', () => { /* … */ });
  it('omits spread when 0', () => { /* '0 4px 8px rgba(0,0,0,0.15)' */ });
  it('emits leading inset for inset shadows', () => { /* inset … */ });
  it('joins multiple shadows with ", "', () => { /* … */ });
  it('returns empty string for an empty list', () => { /* … */ });
});
```

### Round-trip tests

The single most important test:

```ts
it('round-trips a multi-shadow with mixed inset and rgba colors', () => {
  const elements = makeElementsWith({
    boxShadows: [
      { offsetX: 0, offsetY: 4, blur: 8, spread: 0,
        color: 'rgba(0, 0, 0, 0.15)', inset: false },
      { offsetX: 0, offsetY: 1, blur: 2, spread: 0,
        color: 'rgba(0, 0, 0, 0.08)', inset: false },
      { offsetX: 0, offsetY: 0, blur: 0, spread: 1,
        color: '#000000', inset: true },
    ],
  });
  const { tsx, css } = generateCode(elements, ROOT_ID, 'home');
  const { elements: parsed } = parseCode(tsx, css);
  expect(parsed).toEqual(elements);
});
```

Plus existing tests update to verify:

- An element with no shadows produces no `box-shadow` declaration.
- `box-shadow: none` at a breakpoint scope clears an inherited
  shadow on parse and re-emits as `none` on generate.
- `box-shadow: var(--shadow-md)` on the base element falls through
  to `customProperties['box-shadow']` and round-trips byte-equivalent.

---

## Implementation order

Build bottom-up so each step has tests passing before the next is
written. This is the same flow used for the css-animations work.

1. **Types and defaults.** `BoxShadowDef`, `boxShadows` on
   `ScampElement`, `boxShadows: []` on both `DEFAULT_RECT_STYLES`
   and `DEFAULT_ROOT_STYLES`. Update `cloneElementSubtree`'s
   defensive-copy block. Build passes; no runtime effect yet.

2. **Parsers.** `parseBoxShadowSegment`,
   `parseBoxShadowShorthand`, `formatBoxShadowShorthand`. Promote
   `tokenizeTransitionSegment` to a shared helper if it cuts code.
   `test/boxShadowParser.test.ts` written alongside.

3. **CSS property map.** Add the `box-shadow` entry. Update
   `test/cssPropertyMap.test.ts` and `test/agentLossless.test.ts`.
   Now files containing `box-shadow` will newly route into the
   typed field on parse — no UI yet, but the data flows.

4. **Generator.** Emit `box-shadow: …` from the typed field; clear
   any `customProperties['box-shadow']` from being emitted (the
   parser already strips it on the way in, but the generator
   should drop a stale one too). Add the breakpoint / state
   override emit case. `test/boxShadowGenerate.test.ts` and the
   round-trip test pass.

5. **Properties panel section.** `ShadowsSection.tsx`, mounted
   from `UiPanel.tsx`. No new store wiring — `patchElement` and
   the existing state-aware middleware do the right thing. Hand-test
   the WYSIWYG flow: add a shadow, edit it, save the file, reopen
   the file — the row is back. Add a second shadow, drop it on
   `:hover` via the state switcher, save, reopen — the hover
   override is preserved.

6. **Polish.** Empty-state copy ("No shadows. Click + to add one"),
   inset visual indicator on the row, tooltips on each control,
   default-collapse the section when the element has no shadows,
   default-open when it has at least one (matches transitions).

7. **Docs.** Update `agent.md` to mention that `box-shadow` is
   now a typed property. Existing wording about "anything Scamp
   doesn't model rounds-trips through your file unchanged" stays
   true — agent-written shadows the panel can't model still
   round-trip via `customProperties`.

---

## Risks and edge cases

- **Color parsing diversity.** CSS allows a lot of color formats
  (`hsl(0 0% 0% / 0.15)`, modern space-separated `rgb()`, the
  upcoming `oklch()`, etc.). Mitigation: don't validate colors —
  the parser captures whatever non-length, non-`inset` token is
  left over after lengths are consumed. The ColorInput tries to
  parse for the picker; falls back to the raw text input when it
  can't, and it round-trips verbatim either way.
- **`inset` ambiguity in tokenization.** The keyword can appear
  before or after the lengths. Handle by scanning all tokens
  twice: first pass finds and removes `inset`, second pass parses
  the rest. Cheap and unambiguous.
- **Whitespace and comments inside the value.** PostCSS already
  hands us a normalised value string (no comments, single
  whitespace) — the same level the transition parser works at —
  so we don't need to re-normalise. Confirmed in
  `parseCode.ts`'s decl walk.
- **Round-trip stability.** The generator's emit order is
  `offsetX offsetY blur [spread] color` (with inset prepended).
  An agent file that wrote `color first inset 0 4px 8px` will
  re-emit as `inset 0 4px 8px color`. This is not byte-equivalent
  but it IS semantically equivalent. Same trade we make on
  border / padding shorthand normalisation today; matches the
  agent.md's "Scamp may reformat declarations" note.
- **First-paint flicker.** Promoting `box-shadow` from
  `customProperties` to a typed field changes how the element
  renders: previously via `customPropsToStyle` → inline style;
  now via the CSS module rule like every other property. No
  visible flicker because both routes resolve to the same final
  computed style — but the IPC sync now writes into the CSS
  file instead of the JSX, which is the correct behaviour.

---

## Open questions for review

1. **Visibility toggle:** ship without (recommend), ship with
   session-only state, or ship with persistence-via-comment? My
   recommendation in the section above is "without".
   yes we can defer visibility toggle for later please add a note at the end of backlog 4.
2. **Reordering:** ship without (recommend), ship with up/down
   buttons, or wait for the filter story to ship drag-and-drop
   reordering and reuse the pattern across both sections?
   yes you can defer this
3. **Section default-open behaviour:** match transitions
   (default-open when non-empty) — confirmed?
   yes
4. **Image element coverage:** include `<img>` elements in the
   sections list? The story says "every selected element" — we
   exclude image from `BorderSection` today, so for consistency
   I'd exclude it here too. Confirm the call.
   agreed
5. **`box-shadow: inherit` / `initial` / `unset`:** treat as
   parser-refusal (fall through to `customProperties`) — seems
   like the right call, but confirm.
   agreed
