# Typography Tokens in theme.css — Plan

**Status:** Proposed
**Date:** 2026-04-16
**Backlog item:** backlog-2 #2

## Goal

Let users define typography tokens (font sizes, line heights,
font-family stacks) in `theme.css` alongside color tokens, then pick
them from the WYSIWYG typography inputs via a token picker. The
picker inserts `var(--text-lg)` as the stored value and the generated
CSS emits the reference verbatim.

---

## Current state

- `theme.css` already stores a flat list of `--token: value;` pairs
  inside `:root`. `parseThemeFile` returns a `ThemeToken[]` of
  `{ name, value }` — no classification by value today.
- `ThemePanel.tsx` shows one flat list of tokens with a colour swatch
  next to each. Every token is assumed to be a colour.
- The CSS editor already offers `var(--*)` suggestions for every
  token for any property (`cssCompletion.ts` at line 160-170) — so
  raw-CSS autocomplete for typography tokens falls out for free once
  tokens exist.
- `ColorInput` has a Tokens tab in its popover that lists colour
  tokens; selecting one inserts `var(--name)` into the field. This
  is the UX we want to mirror for typography.
- `FontPicker` reads `fontFamily` as an opaque string. A stored
  `var(--font-sans)` value would render as a `Custom:` row today —
  the picker doesn't know it's a token.
- Typography model fields — `fontSize`, `lineHeight`, `letterSpacing`
  — are typed as `number | undefined` and emitted as
  `${value}px` (or unitless for `line-height`). A `var(--text-lg)`
  reference can't be stored today.

---

## Token classification

Pure helper in `src/renderer/lib/tokenClassify.ts`:

```ts
type TypographyTokenCategory =
  | 'color'       // existing — unchanged
  | 'fontSize'    // rem / px / em / % length — used for font-size
  | 'lineHeight'  // unitless number — used for line-height
  | 'fontFamily'  // quoted / comma-separated family stack
  | 'unknown';    // anything else — still preserved in theme.css

export const classifyToken = (value: string): TypographyTokenCategory;
```

Inference rules (best-effort, order matters — first match wins):

1. Starts with a digit followed by `px`, `rem`, `em`, `%`, `pt`,
   `vw`, `vh` → `fontSize`. (Matches what CSS `<length>` accepts.)
2. Starts with a bare number (no unit) and parses as finite →
   `lineHeight`.
3. Contains a quoted string (`"Inter"`) or a known generic family
   (`serif`, `sans-serif`, `monospace`, `cursive`, `system-ui`)
   anywhere → `fontFamily`.
4. Hex, `rgb()`, `rgba()`, `hsl()`, named colour → `color`.
5. Otherwise → `unknown`.

Unknown tokens still appear in the theme.css file and in the
"Unknown" section of the ThemePanel so a user can rename / delete
them. The parser never discards entries.

Unit tests cover every branch plus edge cases: `0` (lineHeight, not
a missing unit), `100%` (fontSize), `'JetBrains Mono', monospace`
(fontFamily).

---

## Model changes

The harder part. Three typography fields are `number` today:

```ts
fontSize?: number;       // px
lineHeight?: number;     // unitless multiplier
letterSpacing?: number;  // px
```

For a `var(--text-lg)` reference to round-trip, these need to hold a
string. Options:

**A) Migrate to string.** `fontSize?: string` stores the full CSS
value including unit (`"16px"`, `"1rem"`, `"var(--text-lg)"`).
Generator emits verbatim. Parser stores the trimmed raw value. UI
input parses-and-reformats for the common px case.

**B) Parallel raw field.** Keep `fontSize: number`; add
`fontSizeRaw?: string` that wins when present. Parser routes
non-px/var values into the raw field.

Going with **A**. Rationale:

- Matches how `color` already works (plain string, with
  `VAR_RE` used to detect token refs at render time).
- Single field per property — no "which one wins" logic at every
  read site.
- The one-time migration burden is small: parser, generator, one
  element-renderer style line, and the Typography UI inputs.

Migration:

- `fontSize`, `lineHeight`, `letterSpacing` → `string | undefined`.
- Parser stores the trimmed raw value (no unit stripping).
- Generator emits the value verbatim (no `${n}px` formatting).
- `ElementRenderer.elementToStyle`:
  `style.fontSize = el.fontSize` (React accepts strings).
  `style.lineHeight = el.lineHeight`.
  `style.letterSpacing = el.letterSpacing`.
- Canvas store element factories: seed with string defaults
  (`fontSize: '14px'`, `color: '#222222'` already string).

Existing projects with `font-size: 16px;` round-trip to
`fontSize: '16px'`. No visible change.

---

## ThemePanel — Typography section

The panel grows a tabbed structure:

```
┌─ Colours ─┬─ Typography ─┬─ Unknown ─┐
```

Each tab is a list of tokens with a matching editor:

- **Colours**: existing UI unchanged.
- **Typography**: a single combined list showing all three
  typography categories (fontSize / lineHeight / fontFamily) with a
  small category badge per row (`Size` / `Line` / `Font`). Editing
  a value reclassifies on blur. No separate sections for size vs
  line vs family — users tend to think in groups of related tokens
  (`--text-xs`, `--text-sm`, `--leading-tight`) and one list with
  badges is less UI to build.
- **Unknown**: tokens whose value the classifier couldn't categorise.
  Full name + value text inputs, no preview.

Row editor for typography:

```
  [◇] [--text-lg        ]  [1.125rem]     [Size]   [x]
  icon   name               value          badge   delete
```

- Leading `IconColorSwatch` (Tabler) in a muted colour, matching
  the icon used in every other token-picker surface. Purely
  decorative — identifies the row as a token.
- Name input: same validation as colour tokens (must start with
  `--`, no spaces).
- Value input: plain text. On blur, `classifyToken(value)` runs; the
  row's badge updates.
- No colour swatch preview — that's colour-specific and lives in
  the Colours tab.

**Add Token** button scoped to the current tab. From the Typography
tab it seeds with a sensible default — the next un-taken
`--text-md`, `--leading-normal`, or `--font-sans`, cycling through
categories so the user can keep adding without retyping names.

Delete behaviour mirrors colours: count usages first (now across
`fontSize`, `lineHeight`, `letterSpacing`, `fontFamily`,
`backgroundColor`, `borderColor`, `color`) and warn if any are
present.

Write path stays `serializeThemeFile({ tokens, fontImportUrls })`
— the serializer already emits tokens in declaration order so
adding typography tokens below colour tokens is a matter of
insertion order in the array.

---

## WYSIWYG token picker integration

Three controls gain a token picker:

### Font family — FontPicker

Already uses the fonts store. Extend the options to include
`fontFamily`-category tokens from `themeTokens` at the top, between
`System font` and the enumerated fonts. Each token row:

- Leading `IconColorSwatch` (Tabler) so typography tokens share a
  visual symbol with the Theme panel and `TokenOrNumberInput`.
- Label: the token name without the `var()` wrapper — `--font-sans`
  — with a small `Token` badge on the right (reuses the `Project`
  badge styling in a different colour).
- On select: `onChange('var(--font-sans)')`.

The stored value round-trips as a plain string; the existing
primary-family extraction doesn't choke on `var(...)` but we'll
special-case it so the trigger shows the token name (with the
swatch icon) rather than a mangled `Custom:` label.

### Font size + line height + letter spacing

Today these are `NumberInput`s. Replace each with a new
**`TokenOrNumberInput`** control (in `components/controls/`):

```ts
type Props = {
  value: string | undefined;
  /** Tokens matching this field's category. */
  tokens: ReadonlyArray<ThemeToken>;
  /**
   * Unit appended when the user types a bare number — Figma-style
   * "fall back to px" behaviour. Pass `''` for fields where unitless
   * is the valid/preferred form (line-height).
   */
  defaultUnit: 'px' | '';
  onChange: (value: string | undefined) => void;
  prefix?: string;
  placeholder?: string;
  min?: number;
  title?: string;
};
```

Behaviour:

- **Numeric display** when `value` is a plain-number-with-unit
  (`16px`, `1.5rem`, `0`) or undefined: shows the numeric part,
  hides the unit for cleanliness (or shows it faintly as a suffix).
  Up/down arrow keys step as today (±1 / ±10).
- **Token display** when `value` starts with `var(`: shows a small
  pill containing the token name (e.g. `--text-lg`). Clicking the
  pill's × clears it back to numeric.
- A small token-picker trigger (`IconColorSwatch` from
  `@tabler/icons-react`) sits at the right of the input. Clicking
  opens a popover listing tokens for the category. Selecting one
  replaces `value` with `var(--name)`. Use the same icon for every
  token-related affordance across the app so users learn one
  symbol.
- **Unit validation on commit.** Parse the trimmed input:
  - Ends with a known CSS unit (`px`, `rem`, `em`, `%`, `pt`, `vw`,
    `vh`) → accept as-is.
  - Bare number and `defaultUnit` is `'px'` → auto-append `px`
    (`"16"` → `"16px"`). Matches Figma's behaviour.
  - Bare number and `defaultUnit` is `''` (line-height) → accept
    unitless (`"1.5"` stays `"1.5"`).
  - Starts with `var(` → accept as-is (token reference).
  - Non-numeric, non-token, non-recognised → revert to the previous
    value on blur. Don't crash, don't surface an error dialog —
    matches the existing `NumberInput` revert-on-invalid UX.

One component, three usage sites. Keeps the typography inputs
visually consistent with the existing panel.

### `onOpenTheme` affordance

Both `FontPicker`'s token header and `TokenOrNumberInput`'s popover
include an "Add token" row when the token list is empty, the same
way `ColorInput` already does. Hooks into the existing
`openThemePanel` store action so the user can jump straight to
managing tokens.

---

## Raw CSS editor

Already works — `cssCompletion.ts` pulls tokens via `getTokens()`
and emits `var(--name)` suggestions for every property. Typography
tokens flow through unchanged once they exist in `themeTokens`.

One improvement: add font-size / line-height keyword suggestions to
`CSS_VALUES_BY_PROPERTY` so the user gets `16px`, `1rem`, `1.125rem`
alongside token suggestions. Out of scope for this story but noted.

---

## Implementation phases

### 1. Classifier + tests

1. `src/renderer/lib/tokenClassify.ts` with `classifyToken`.
2. `test/tokenClassify.test.ts` covering every branch + edges.

### 2. Model migration

1. Change `fontSize` / `lineHeight` / `letterSpacing` on
   `ScampElement` to `string | undefined`.
2. `cssPropertyMap.ts`: drop `parsePx` for these, store raw string.
3. `generateCode.ts`: emit verbatim.
4. `ElementRenderer.tsx`: pass-through to inline style.
5. Element factories in `canvasSlice.ts`: seed `fontSize: '14px'`
   on text elements (was `14`).
6. Update existing tests that assume numeric values (round-trip +
   parser test files).

**Acceptance:** round-trip test passes with string typography
values; existing projects with `font-size: 16px;` render identically.

### 3. ThemePanel typography tab

1. Refactor `ThemePanel` to host a tab bar (`Colours` / `Typography`
   / `Unknown`) with a shared token list scoped to the active tab
   by classification.
2. Row editor: name + value inputs, category badge derived from
   `classifyToken(value)` on every render.
3. Wire add / delete / rename / value-edit through the existing
   `writeTokens` path.

**Acceptance:** create, rename, delete typography tokens from the
panel; changes hit theme.css; chokidar reload updates the tabs
without blowing away the user's edit focus.

### 4. TokenOrNumberInput + wiring

1. Build the control with numeric / pill states and the token
   picker popover.
2. Replace the font-size / line-height / letter-spacing
   `NumberInput`s in `TypographySection` with the new control.
3. Pass filtered tokens per field (`classifyToken` === 'fontSize'
   for font-size, etc.).

**Acceptance:** pick a token from font-size → CSS emits
`font-size: var(--text-lg);`, round-trips, renders the resolved
size on the canvas.

### 5. FontPicker token support

1. Extend picker options with `fontFamily`-category tokens above
   system/project fonts.
2. Render the trigger label as the token name when the stored value
   is `var(--...)`.

**Acceptance:** `var(--font-sans)` picked from FontPicker writes a
clean font-family, reloads as the token pill.

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/lib/tokenClassify.ts` | New — classifier |
| `src/renderer/lib/element.ts` | Migrate 3 typography fields to `string` |
| `src/renderer/lib/defaults.ts` | (unaffected — fields are optional) |
| `src/renderer/lib/cssPropertyMap.ts` | Drop `parsePx` for fontSize / lineHeight / letterSpacing |
| `src/renderer/lib/generateCode.ts` | Emit typography values verbatim |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Pass-through to inline style |
| `src/renderer/store/canvasSlice.ts` | Text element factory seeds `'14px'` |
| `src/renderer/src/components/ThemePanel.tsx` | Tab bar + typography list |
| `src/renderer/src/components/ThemePanel.module.css` | Tab styling |
| `src/renderer/src/components/controls/TokenOrNumberInput.tsx` | New |
| `src/renderer/src/components/controls/TokenOrNumberInput.module.css` | New |
| `src/renderer/src/components/sections/TypographySection.tsx` | Use new control + filtered tokens |
| `src/renderer/src/components/controls/FontPicker.tsx` | Prepend fontFamily tokens |
| `test/tokenClassify.test.ts` | New |
| `test/cssPropertyMap.test.ts` | Update font-size / line-height / letter-spacing tests |
| `test/generateCode.test.ts` | Update typography emit tests |

---

## Out of scope

- **Spacing tokens** (`--spacing-md: 16px`) applied to padding /
  margin. The backlog explicitly parks this.
- **Font-weight tokens**. Weight is a closed enum (400/500/600/700)
  in the model — adding `var()` support would require migrating it
  to string too. Noted as follow-up.
- **Unit suggestion in CSS editor value completion** (e.g.
  `16px` / `1rem` presets for `font-size`). Small and orthogonal;
  can land any time.
- **Renaming usages automatically** when a token is renamed. Today
  we already don't do this for colour tokens; no change.

---

## Risks

- **Model migration touches the round-trip test.** The round-trip
  invariant (`parseCode(generateCode(x)) === x`) is load-bearing;
  the string migration changes the shape of `fontSize` values.
  Update the test fixtures to string form and confirm the
  invariant still holds.

- **Classification ambiguity.** `100%` could plausibly be a size or
  a line-height. The classifier picks size (unit rule wins over
  unitless). Users can override by editing the value. Document
  the classifier rules in-panel so no one's surprised.

- **`font-family: system-ui` without quotes.** The classifier rule
  #3 (quoted string OR known generic) covers this. Tested.

- **A Typography token used on a non-text element.** Nothing
  prevents a user from applying `var(--text-lg)` to `backgroundColor`
  by hand-editing the CSS. Our classifier only cares about *what
  the token holds*, not *where it's used*. The WYSIWYG filter by
  category keeps users from accidentally doing this from the panel,
  but hand-written CSS is on the user.

- **Picker popover placement inside a narrow panel.** The existing
  ColorInput popover uses fixed positioning with viewport clamping.
  `TokenOrNumberInput` will reuse the same pattern (same effect we
  wrote for `FontPicker`). Worth factoring out into a shared
  `usePopoverPosition` hook during implementation.

- **Breaking change for existing CSS.** If users have files with
  `font-size: 16px`, they continue to work — the parser now stores
  `'16px'` and the generator emits `'16px';`. Byte-identical output
  (modulo the missing space you'd get from the old `${n}px` path,
  which was already `16px` with no space).
