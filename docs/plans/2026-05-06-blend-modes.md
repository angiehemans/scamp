# CSS Blend Modes — Plan

**Status:** Draft for review.
**Date:** 2026-05-06
**Source:** `docs/backlog-4.md` story #2
**Related:** Box shadow (story #1, just shipped — same "promote a
property to a typed enum field, route through `cssPropertyMap`,
auto-cascade through state/breakpoint overrides" pattern).

---

## Goal

Let users pick a CSS blend mode from the WYSIWYG panel without writing
CSS by hand. Two axes:

- **`mix-blend-mode`** — how the entire element blends with content
  behind it. Single dropdown, applies to every element type.
- **`background-blend-mode`** — how a background image blends with
  the background color of the same element. Surfaces only when both
  axes are present (color is non-default AND image is set).

Both default to `normal` and the generator omits the declaration when
they're at default — keeping output clean.

---

## Current state — what we can build on

- **Box shadow** (just shipped) — the closest analogue. Single
  property, single mapper in `cssPropertyMap.ts`, single emit branch
  in `generateCode.ts`, automatic cascade through state /
  breakpoint overrides via `Partial<ScampElement>`.
- **`EnumSelect`** in `controls/` — but it doesn't support
  `<optgroup>`. The blend-mode dropdown wants groups (Darken /
  Lighten / Contrast / Inversion / Component) per the story spec.
  Either extend `EnumSelect` to take grouped options, or use a raw
  `<select>` with `controlStyles.select` like
  `AnimationSection`'s `PresetSelect` already does. Reuse that
  pattern — don't generalise `EnumSelect` for one caller.
- **`VisibilitySection`** already groups opacity + visibility-mode
  ("appearance-y" element-level concerns). Extending it with the
  mix-blend-mode dropdown keeps the panel compact without adding a
  new section header.
- **`BackgroundSection`** already conditionally shows controls when
  a background image is set (`{bgImage && (...)}`). The
  background-blend dropdown slots into the same conditional block.
- **Lossless contract** — agent-written
  `mix-blend-mode: plus-darker` (a value outside our enum) returns
  `null` from the mapper and falls through to `customProperties`,
  same as box-shadow's `var()` case.

What's NOT there yet:

- No element-level fields for either blend mode.
- No `mix-blend-mode` / `background-blend-mode` entries in
  `cssToScampProperty`. Both currently land in `customProperties`.
- No grouped-options primitive in `EnumSelect` (we'll inline a
  raw `<select>` instead).

---

## Non-goals for this story

- **`isolation: isolate`.** The story explicitly notes this as
  related-but-out-of-scope. The CSS property controls the stacking
  context that blend modes resolve in, and an agent may need to add
  it manually. It already round-trips verbatim via
  `customProperties`. No UI for it now; documentation in `agent.md`
  could mention it as a useful pairing in a follow-up.
- **`background-blend-mode` per-layer support.** CSS allows a
  comma-separated list when there are multiple background layers
  (`background-blend-mode: multiply, screen`). We model a single
  layer (one bg color + one bg image), so a single value suffices.
  Multi-layer agent writes would refuse and round-trip via
  `customProperties` — same fallback as box-shadow's `var()` case.
- **Custom blend modes / experimental values** (`plus-darker`,
  `plus-lighter`). Outside our enum → fall through to
  `customProperties` so agent writes survive.
- **Visual preview of the blend in the panel itself.** The canvas
  already renders the blend natively (DOM-based, browser handles
  `mix-blend-mode`); a separate preview swatch in the dropdown is
  out of scope.

---

## Data model

### New types

```ts
// src/renderer/lib/element.ts

/**
 * The full set of CSS blend-mode keywords Scamp models as a typed
 * field. Matches the WYSIWYG dropdown groups from the story spec
 * (Darken / Lighten / Contrast / Inversion / Component) plus the
 * default `normal`. Anything outside this list — `plus-darker`,
 * `plus-lighter`, vendor-prefixed, future spec additions — is
 * preserved verbatim via `customProperties`.
 *
 * Used for both `mix-blend-mode` and `background-blend-mode`. The
 * keyword set is identical for the two properties.
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'darken'
  | 'color-burn'
  | 'screen'
  | 'lighten'
  | 'color-dodge'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';
```

### Extended `ScampElement`

```ts
export type ScampElement = {
  // ... existing fields ...

  /**
   * CSS `mix-blend-mode`. Default `'normal'` emits no declaration.
   * Any other value emits `mix-blend-mode: <value>` so the cascade
   * makes the element blend with content behind it. Round-trips
   * through `parseCode` via `cssToScampProperty`.
   */
  mixBlendMode: BlendMode;

  /**
   * CSS `background-blend-mode`. Default `'normal'` emits no
   * declaration. Only meaningful when both a background color and
   * a background image are set on the element — the panel hides
   * the control otherwise, but the data model permits it freely so
   * agent edits round-trip.
   */
  backgroundBlendMode: BlendMode;
};
```

### Defaults

```ts
// src/renderer/lib/defaults.ts — DEFAULT_RECT_STYLES and
// DEFAULT_ROOT_STYLES both gain:

mixBlendMode: 'normal' as const,
backgroundBlendMode: 'normal' as const,
```

The default of `'normal'` means the generator's "only emit
non-default" rule omits both declarations on every existing file —
zero churn on the first save after the upgrade.

### Migration of existing files

Files in the wild may carry `mix-blend-mode: multiply` (or the
background variant) inside `customProperties` — the previous parser
dropped them there because there was no typed routing. After this
change a fresh parse routes recognised values into the typed fields
and removes them from `customProperties`. Unrecognised values stay
in `customProperties` unchanged. The generator never emits the same
property from both paths — the parser strips it on the way in.

Same migration model the box-shadow story used: no churn for
existing files, smooth promotion on first re-save for those with
typed-recognisable values.

### State / breakpoint overrides

Both fields are typed CSS values. `BreakpointOverride` and
`StateOverride` are generated via `Partial<Omit<ScampElement, …>>`,
so the new fields are automatically opt-in for both axes — agents
can write per-state hover blends and per-breakpoint blend changes
without any extra wiring. The override emit / parse helpers already
walk `cssToScampProperty` keys generically.

A verification test in the test plan confirms hover-state blend
mode round-trips.

---

## Parsers — `src/renderer/lib/parsers.ts`

No new shorthand parsing needed: blend modes are single-keyword
values. A small validator suffices, kept inline in the
`cssPropertyMap` mapper rather than as a separate exported helper
(it would be a one-liner with no other callers).

```ts
const BLEND_MODE_VALUES: ReadonlySet<string> = new Set([
  'normal',
  'multiply',
  'darken',
  'color-burn',
  'screen',
  'lighten',
  'color-dodge',
  'overlay',
  'soft-light',
  'hard-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
]);

const isBlendMode = (v: string): v is BlendMode =>
  BLEND_MODE_VALUES.has(v);
```

---

## Property map — `src/renderer/lib/cssPropertyMap.ts`

```ts
'mix-blend-mode': (v) => {
  const trimmed = v.trim().toLowerCase();
  if (!isBlendMode(trimmed)) return null;
  return { mixBlendMode: trimmed };
},
'background-blend-mode': (v) => {
  const trimmed = v.trim().toLowerCase();
  if (!isBlendMode(trimmed)) return null;
  return { backgroundBlendMode: trimmed };
},
```

Refusing on unknown keywords is the lossless contract: an agent
writing `mix-blend-mode: plus-darker` returns `null` from the
mapper, the parser routes the raw declaration into
`customProperties`, and the generator emits it back unchanged. Same
pattern as `position` for unknown position values.

`background-blend-mode: multiply, screen` (multi-layer) hits the
same path — the comma-separated value is not in the keyword set, so
it stays in `customProperties` and round-trips byte-equivalent.

The keyword set declared in `cssPropertyMap.ts` and reused by the
panel dropdown (via an exported `BLEND_MODE_GROUPS` constant) keeps
the two surfaces in sync.

---

## Code emission — `src/renderer/lib/generateCode.ts`

A small emit branch alongside the box-shadow / transition block on
the main rule body:

```ts
// Mix blend mode — `normal` is the default, omit the declaration.
if (el.mixBlendMode !== BASE.mixBlendMode) {
  lines.push(`mix-blend-mode: ${el.mixBlendMode};`);
}
// Background blend mode — same treatment. Emitted regardless of
// whether a background image is set; the property has no visible
// effect without one but is harmless and round-trips cleanly.
if (el.backgroundBlendMode !== BASE.backgroundBlendMode) {
  lines.push(`background-blend-mode: ${el.backgroundBlendMode};`);
}
```

For breakpoint and state overrides, the `breakpointOverrideLines`
helper that walks `cssToScampProperty` keys gains two cases mirroring
how `transitions` is handled today:

```ts
if (has('mixBlendMode') && override.mixBlendMode !== undefined) {
  lines.push(`mix-blend-mode: ${override.mixBlendMode};`);
}
if (
  has('backgroundBlendMode') &&
  override.backgroundBlendMode !== undefined
) {
  lines.push(`background-blend-mode: ${override.backgroundBlendMode};`);
}
```

A breakpoint or state override can carry `mixBlendMode: 'normal'` to
explicitly clear an inherited blend at that scope — the override
emit branch fires only when the field is *defined*, not based on
whether it equals the default. (Same convention transitions uses
with `transition: none`.)

---

## UI

### Mix blend mode — `VisibilitySection.tsx`

The story says the dropdown lives "in the appearance section of the
WYSIWYG panel". Scamp doesn't have a section literally named
"Appearance", but `VisibilitySection` already groups
element-level appearance concerns (opacity + display visibility) and
is the natural home. Add a third row to the existing section.

```
┌─ Visibility ───────────────────── ┐
│  Opacity   [   100   ] %          │
│  Display   [Visible|Hidden|None]  │
│  Blend     [ Normal ▾ ]           │  ← new
└────────────────────────────────────┘
```

The `Section` component's `fields` prop gains `'mixBlendMode'` so
the override-indicator dot lights up when the field has an active
state / breakpoint override.

### Background blend mode — `BackgroundSection.tsx`

A row added to the existing `{bgImage && (<>...</>)}` block. Visible
only when:

- A background image is set (`bgImage` truthy), AND
- The background color is non-default. The story says "Only visible
  when both a background color and a background image are set" —
  treat any non-`'transparent'` `backgroundColor` as "set". The
  default rect baseline has `backgroundColor: 'transparent'`, so an
  unmodified element gets no control.

Outside of those conditions the dropdown is hidden. The data still
round-trips: an agent could set `background-blend-mode: multiply`
without an image; the parser routes it into the typed field and
the generator re-emits it on save, even though the UI doesn't
expose a control for the orphan state.

### Dropdown layout

Both dropdowns reuse the same component, `BlendModeSelect`, that
renders a native `<select>` with `<optgroup>` so the categories
from the story show up as visual groups:

```tsx
<select className={controlStyles.select} value={value} onChange={...}>
  <option value="normal">Normal</option>
  <optgroup label="Darken">
    <option value="multiply">Multiply</option>
    <option value="darken">Darken</option>
    <option value="color-burn">Color burn</option>
  </optgroup>
  <optgroup label="Lighten">
    <option value="screen">Screen</option>
    <option value="lighten">Lighten</option>
    <option value="color-dodge">Color dodge</option>
  </optgroup>
  <optgroup label="Contrast">
    <option value="overlay">Overlay</option>
    <option value="soft-light">Soft light</option>
    <option value="hard-light">Hard light</option>
  </optgroup>
  <optgroup label="Inversion">
    <option value="difference">Difference</option>
    <option value="exclusion">Exclusion</option>
  </optgroup>
  <optgroup label="Component">
    <option value="hue">Hue</option>
    <option value="saturation">Saturation</option>
    <option value="color">Color</option>
    <option value="luminosity">Luminosity</option>
  </optgroup>
</select>
```

The grouped `<option>` data lives in
`src/renderer/lib/blendModes.ts` — a tiny module that exports
`BLEND_MODE_GROUPS` (for the UI) and `BLEND_MODE_VALUES` (for the
mapper validator) so the keyword list has one source of truth.

### Canvas rendering

`mix-blend-mode` and `background-blend-mode` are CSS properties
the browser handles natively. `ElementRenderer.tsx` needs branches
that mirror the new typed fields so the canvas matches the file
output:

```ts
if (el.mixBlendMode !== 'normal') {
  base.mixBlendMode = el.mixBlendMode;
}
if (el.backgroundBlendMode !== 'normal') {
  base.backgroundBlendMode = el.backgroundBlendMode;
}
```

Slots in next to the existing `boxShadow` branch. No other canvas
changes needed — the browser does the actual blending.

---

## Tests

New file: `test/blendModes.test.ts`.

Updates to existing files:

- `test/cssPropertyMap.test.ts` — `describe('mix-blend-mode', …)`
  and `describe('background-blend-mode', …)` blocks: each value
  recognised, unknown keyword refused, case-insensitive parsing.
- `test/agentLossless.test.ts` — assert
  `mix-blend-mode: plus-darker` and
  `background-blend-mode: multiply, screen` survive verbatim.
- `test/defaults.test.ts` — extend the `DEFAULT_RECT_STYLES`
  shape assertion to include the new fields.
- The element-construction test fixtures (the same set of files
  the box-shadow plan touched) all need
  `mixBlendMode: 'normal'` and `backgroundBlendMode: 'normal'`.

### blendModes.test.ts cases

Round-trip-focused, mirroring `boxShadow.test.ts`:

```ts
describe('blend mode: generator', () => {
  it('omits both declarations when both fields are normal', () => {});
  it('emits mix-blend-mode for non-default value', () => {});
  it('emits background-blend-mode for non-default value', () => {});
  it('emits both when both are set', () => {});
});

describe('blend mode: parser', () => {
  it('routes mix-blend-mode keyword into the typed field', () => {});
  it('routes background-blend-mode keyword into the typed field', () => {});
  it('preserves an unknown blend keyword in customProperties', () => {});
  it('parses keywords case-insensitively', () => {});
});

describe('blend mode: round-trip', () => {
  it('round-trips a hover-state mix-blend-mode override', () => {
    // Confirms the auto-cascade through stateOverrides works.
  });
  it('round-trips a tablet-breakpoint background-blend-mode', () => {});
});
```

Plus the existing `agentLossless` style:

- `mix-blend-mode: plus-darker;` round-trips byte-equivalent.
- `background-blend-mode: multiply, screen;` round-trips
  byte-equivalent (multi-layer not modelled — falls through).

---

## Implementation order

Bottom-up, each step ships with passing tests before moving on (the
flow used for box-shadow and css-animations).

1. **Types and defaults.** `BlendMode` type, `mixBlendMode` /
   `backgroundBlendMode` fields on `ScampElement`, `'normal'`
   defaults on both `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES`.
   Update `groupSiblings` and `wrapElement` element templates plus
   `cloneElementSubtree` (no defensive copy needed for primitives).
   Update test fixtures across `test/` (mechanical edit — same set
   the box-shadow plan touched, plus the element-construction sites
   that already have the box-shadow line). Build passes.

2. **Blend-mode constants module.**
   `src/renderer/lib/blendModes.ts` exports `BLEND_MODE_VALUES`
   (set), `BLEND_MODE_GROUPS` (ordered for the dropdown), and
   `isBlendMode` (type guard). Single source of truth for the
   mapper + the UI.

3. **CSS property map.** Two new mapper entries in
   `cssPropertyMap.ts`. Update `cssPropertyMap.test.ts` and
   `agentLossless.test.ts`. Files with `mix-blend-mode` / unknown
   keywords now route correctly.

4. **Generator.** Add the two emit branches on the main rule body
   plus the override branches in `breakpointOverrideLines`. Write
   `test/blendModes.test.ts` round-trip cases. Tests pass.

5. **Canvas renderer.** `ElementRenderer.tsx` branches that set
   `base.mixBlendMode` / `base.backgroundBlendMode` when non-default.

6. **Visibility section.** Add the Blend row to
   `VisibilitySection.tsx` using the new `BlendModeSelect`
   component. Add `'mixBlendMode'` to the section's `fields` prop
   so override indicators surface correctly.

7. **Background section.** Add the Background-blend row inside the
   existing `{bgImage && (...)}` conditional, gated also on
   `element.backgroundColor !== 'transparent'`. Reuse
   `BlendModeSelect`.

8. **Polish.** Tooltips on each dropdown. Section's `FIELD_LABELS`
   gets entries for `mixBlendMode` → `mix-blend-mode` and
   `backgroundBlendMode` → `background-blend-mode` so the
   override-indicator tooltip reads naturally.

9. **Docs.** Update `agent.md` to mention `mix-blend-mode` and
   `background-blend-mode` as typed properties (matching the
   box-shadow update). Add a brief note about `isolation: isolate`
   round-tripping via `customProperties` as a helpful pairing.

---

## Risks and edge cases

- **Hyphenated values vs camelCase storage.** CSS keywords are
  hyphenated (`color-burn`). Storing them as the literal CSS
  string keeps mapper / generator simple — no conversion layer.
  The TypeScript type uses the hyphenated string as a literal
  union member, which works fine in TS strict mode. No
  `kebabToCamel` round-trip needed.
- **Background-blend-mode without a background image.** Visible in
  CSS but invisible on screen. The UI hides the control in this
  case; the data model permits it (orphan typed field stays at
  whatever it was, generator emits / round-trips). This is a
  deliberate "data layer permits more than UI exposes" trade.
- **Multi-layer `background-blend-mode`** (`multiply, screen`).
  Single-keyword validator refuses → `customProperties`
  fallthrough → byte-equivalent round-trip. UI doesn't expose it.
  Documented in the test plan as the lossless contract case.
- **`isolation: isolate` interaction.** Without an isolating
  parent, a `mix-blend-mode` element blends through to the page
  root, not just its container — surprising for users coming from
  Figma. Out of scope for this story but worth a tooltip note in
  follow-up: the canvas renders the actual behaviour, so users see
  what their export will do.
- **`EnumSelect` not extended.** Tempting to add optgroup support
  there, but the only caller is this dropdown — premature
  abstraction. Inline a raw `<select>` with `controlStyles.select`
  matching `AnimationSection`'s `PresetSelect`. Future grouped
  enums (filters?) can lift this into a shared component once
  there are 2+ callers.

---

## Open questions for review

1. **Section placement for mix-blend-mode.** Add a Blend row to
   the existing `VisibilitySection` (recommend) or create a new
   `EffectsSection` between Visibility and Transitions?
   Recommendation: extend `VisibilitySection` — fewer section
   headers, related to opacity, matches Figma's UX. 
   go with reccommended
2. **Background-blend gate condition.** Show the dropdown when
   `bgImage && backgroundColor !== 'transparent'` (recommend), or
   only when `bgImage` is set regardless of color? The story says
   "both must be set"; treating `'transparent'` as "no color" is
   the intuitive read but worth confirming.
   agreed with recommendation.
3. **Typed `backgroundBlendMode` vs. `customProperties` storage.**
   The plan promotes both blend modes to typed fields (consistent
   with the typed-promotion pattern). Alternative: only typed
   `mixBlendMode`, leave `background-blend-mode` in the
   `customProperties` bag alongside `background-image` etc.
   Recommendation: typed for both — consistent, validated, safe.
   Agreed.
4. **`normal` at state/breakpoint scope.** When a user picks
   `Normal` at a non-default state via the dropdown, do we write
   `mix-blend-mode: normal` (explicit clear of an inherited
   non-normal base) or remove the override field entirely (let it
   cascade)? Recommendation: write `'normal'` explicitly when the
   user picked it — matches transitions' "empty list emits
   `transition: none`" convention. Cascading-by-omission is what
   the user gets by not touching the dropdown at all.
   agreed.
5. **Tooltip for the canvas-vs-export caveat on
   `isolation`.** Add a small inline hint near the mix-blend-mode
   dropdown ("blends through to the page root unless an ancestor
   has `isolation: isolate`"), or skip it as too in-the-weeds for
   v1? Recommendation: skip for v1, document in `agent.md` only.
agreed.