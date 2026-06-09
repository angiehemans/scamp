# Plan — `var()` in padding / margin / gap / border-radius

## Problem

Scamp's typed parsers for `padding`, `margin`, `gap`, `column-gap`,
`row-gap`, `border-width`, and `border-radius` only accept plain px
tokens. Anything else — `var(--space-md)`, `rem`, `%`, `auto` — makes
`parsePaddingShorthandOrNull` / `parsePxOrNull` return `null`, the
mapper returns `null`, and the whole declaration falls into
`customProperties`. The browser renders the page correctly (CSS
resolves the variable) but the panel's Padding / Gap / Border Radius
controls show empty — the user has no way to know or edit those
values from the canvas, and no indication anything is set.

This bites every project that uses a token-based spacing scale (i.e.
every project we expect agents to build). Token usage is encouraged
by `agent.md`, so Scamp is effectively encouraging a pattern that
disables a chunk of its own panel UI.

Affected properties (in `src/renderer/lib/cssPropertyMap.ts`):

| Property | Parser | Falls to customProperties when |
|---|---|---|
| `padding`, `margin` | `parsePaddingShorthandOrNull` | any token isn't plain px |
| `border-width` | `parsePaddingShorthandOrNull` | any token isn't plain px |
| `border-radius` | `parseBorderRadiusShorthandOrNull` | any token isn't plain px |
| `gap`, `column-gap`, `row-gap` | `parsePxOrNull` | value isn't plain px |

Properties NOT affected (already preserve the custom string in their
typed shape):

- `width`, `height`, `min-*`, `max-*` — `parseSizeValue` stores
  `{ mode: 'fixed', value, custom }` for arbitrary values.
- `color`, `background-color`, `border-color`, `font-family` — string
  passthrough.
- `box-shadow`, `font-size`, `letter-spacing`, `line-height` —
  raw string storage.

## Two-stage solution

### Stage 1 — Panel "custom value present" indicator (short-term)

Goal: tell the user that a property they think is unset actually has a
custom value the panel can't model, and offer a way to view or
replace it.

**Detection.** The save engine already knows: when an element's
`customProperties` has a key matching a property the panel exposes
(e.g. `padding`, `gap`, `border-radius`), the typed control is
shadowed. Add a derived selector in the panel slice:

```ts
type CustomShadow = {
  property: string;        // CSS property name, e.g. 'padding'
  value: string;           // raw value as written, e.g. 'var(--space-md)'
  shadowsTypedControl: boolean;
};

export const selectCustomShadows = (el: ScampElement): CustomShadow[] => {
  return Object.entries(el.customProperties)
    .filter(([key]) => TYPED_CONTROL_KEYS.has(key))
    .map(([property, value]) => ({
      property,
      value,
      shadowsTypedControl: true,
    }));
};
```

Where `TYPED_CONTROL_KEYS` is `padding`, `margin`, `gap`, `column-gap`,
`row-gap`, `border-radius`, `border-width`.

**UI surface.** Each affected typed control in the inspector gets a
small badge (e.g. a colored dot in the corner of the input group)
when a shadow exists. Hovering the badge opens a popover:

```
┌────────────────────────────────────────┐
│ Custom padding value                   │
│ ──────────────────────                 │
│ padding: var(--space-sm) var(--space-md);│
│                                        │
│ This element has a CSS value Scamp's   │
│ panel can't edit. The page renders     │
│ correctly. To use the panel's typed    │
│ control, replace this declaration with │
│ pixel values.                          │
│                                        │
│ [ Replace with 0 0 0 0 ]  [ Edit raw ] │
└────────────────────────────────────────┘
```

- **Replace** — removes the customProperties entry and writes the
  typed control's current value (default 0). User gets panel control.
- **Edit raw** — opens the existing raw-CSS panel scrolled to the
  declaration, so the user can edit by hand.

**Scope.** Stage 1 doesn't change parsers, codegen, or the typed
model. It's pure derived UI on top of `customProperties`. Self-
contained, no migration, low risk.

**Files touched.**

- `src/renderer/store/canvasSlice.ts` — add `selectCustomShadows`.
- `src/renderer/src/components/inspector/PaddingControl.tsx` (and
  siblings for gap / border-radius / margin) — render the badge.
- `src/renderer/src/components/inspector/CustomShadowPopover.tsx`
  (new) — the explanatory popover + actions.
- Tests in `test/customShadows.test.ts` — selector covers each
  affected property.

**Estimate.** ~1 day. Mostly UI plumbing.

### Stage 2 — Accept `var()` and other tokens in the typed parsers (medium-term)

Goal: tokens become first-class in spacing properties. The panel
shows a useful representation and the user can pick from the project's
spacing scale without dropping into code.

**Model change.** The typed `padding` / `margin` shape is currently:

```ts
padding: [number, number, number, number];  // top, right, bottom, left, in px
```

Change to:

```ts
type SpaceValue = number | { kind: 'token'; ref: string };
//   number form: plain px value, e.g. 16
//   token form: { kind: 'token', ref: 'var(--space-md)' }

padding: [SpaceValue, SpaceValue, SpaceValue, SpaceValue];
```

Same for `margin`, `border-width`, `border-radius`, and `gap` /
`column-gap` / `row-gap` (single `SpaceValue` for the gap props).

**Parser change.** Update `parsePaddingShorthandOrNull` so each token
is parsed as EITHER a plain px number OR a `var(--…)` reference. Mixed
forms (`16px var(--space-md)`) are fine — each side keeps its own
representation. Any other unit (`rem`, `%`, `auto`) still rejects and
falls to customProperties — Stage 2 doesn't try to be comprehensive.

**Generator change.** `elementDeclarationLines` emits each side's
value in its original form. The shorthand collapse (1 / 2 / 3 / 4
values) needs to be aware of both forms when comparing for equality.

**Panel change.** The padding control becomes a per-side input that
accepts EITHER a number OR a dropdown of the project's spacing tokens.
The token list is read from `theme.css` at render time (the same place
the existing color-token picker reads from). User can switch sides
freely:

```
Padding
┌──────┬──────┐
│ top  │ 16   │  ← plain number
├──────┼──────┤
│ right│ ⌃space-md │  ← token (picker open)
├──────┼──────┤
│ bot  │ 16   │
├──────┼──────┤
│ left │ ⌃space-md │
└──────┴──────┘
```

**Migration path.** Two compatibility branches:

1. Files written before Stage 2 use the old number-only shape; parse
   handles both. No project migration needed.
2. Files where padding was previously in `customProperties` (because
   it had `var()`) get re-parsed: `parsePaddingShorthandOrNull` now
   succeeds, the declaration moves OUT of `customProperties` and INTO
   the typed shape. The next save emits canonical form. Users see
   Stage 1's "shadow" badge disappear automatically.

**Files touched.**

- `src/renderer/lib/element.ts` — extend the `SpaceValue` type.
- `src/renderer/lib/parsers.ts` — `parsePaddingShorthandOrNull`,
  `parsePxOrNull`, `parseBorderRadiusShorthandOrNull` accept var().
- `src/renderer/lib/cssPropertyMap.ts` — return `SpaceValue` shapes
  instead of plain numbers.
- `src/renderer/lib/generateCode.ts` — `elementDeclarationLines`
  emits each side's value in its stored form; shorthand collapse
  becomes value-aware.
- `src/renderer/lib/defaults.ts` — `DEFAULT_RECT_STYLES` updated to
  use `SpaceValue` in padding/margin.
- All inspector controls for affected properties — token picker UI.
- Tests:
  - `test/parsers.test.ts` — round-trip every combination of px /
    token / mixed across all four sides.
  - `test/generateCode.test.ts` — shorthand collapse with tokens.
  - `test/parseCode.test.ts` — files with `padding: var(--space-md);`
    parse into typed shape, no longer fall to customProperties.

**Estimate.** ~3-5 days. Type changes ripple through controls and
codegen, and the inspector UI for token picking is non-trivial.

## Decision points the user should weigh

1. **Stage 1 alone, or jump to Stage 2?** Stage 1 is a real
   improvement but doesn't fix the "panel can't edit my spacing"
   complaint. Stage 2 fixes it but is a week of work. Shipping both is
   probably right — Stage 1 unblocks every existing project
   immediately while Stage 2 cooks. just jump to stage 2, we need it.

2. **Which tokens does Stage 2 accept?** Just `var(--*)`? Also
   `calc(...)`? Also `rem` / `em`? Recommend `var()` only for v1 —
   it's by far the dominant pattern in agent-written CSS, and
   adding more value shapes blows up the panel UI surface. just var is fine

3. **Display of token values in the panel.** Show the token name
   (`space-md`), the resolved px value (`32px`), or both? Resolved
   px requires reading `theme.css` at render time. Token name alone
   is simpler but less informative when the user doesn't remember the
   scale. Recommend "name with resolved px on hover." just token name is fine.

4. **Should Stage 1's `Replace with 0 0 0 0` button exist?** It's
   destructive (loses the token reference). Alternative: only offer
   "Edit raw" and rely on the user to make the call. Recommend
   keeping Replace but make it require an explicit click on a value
   first (i.e. typing into the typed control directly does the
   replacement implicitly, but doing so from the popover button
   alone isn't enough). no it shouldnt exist.

## Out of scope

- Other unit conversions (`rem`, `em`, `vh`, `vw`). Possible later if
  they show up in real agent output, but not now.
- A spacing-scale editor inside Scamp (managing `--space-*` tokens
  themselves). Tokens live in `theme.css`; users edit them there.
- The same problem in `transform`, `filter`, `clip-path`, etc. —
  Scamp doesn't try to model these as typed fields at all.
