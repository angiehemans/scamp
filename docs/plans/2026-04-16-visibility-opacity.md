# Visibility and Opacity Controls — Plan

**Status:** Proposed
**Date:** 2026-04-16
**Backlog item:** backlog-2 #1

## Goal

Give every element two new property-panel controls that write real
CSS and round-trip cleanly:

- **Opacity** — 0–100 number input + range slider, maps to CSS
  `opacity`.
- **Visibility** — segmented control with *Visible* / *Hidden* / *None*
  mapping to no declaration, `visibility: hidden`, and `display: none`.

Canvas keeps hidden elements selectable so the user doesn't lose them
the moment they set "none".

---

## Current state

- `ScampElement` has no opacity or visibility field. Opacity written
  by an agent lands in `customProperties` (and therefore applies at
  preview time but isn't editable via the panel).
- The model already has a field named `display: 'none' | 'flex'`, but
  its `'none'` value means **"not a flex container"** — it never
  emits `display: none` to CSS. The Layout section labels the two
  modes *Block* / *Flex*. The new Visibility "None" value needs to
  map to the CSS `display: none` concept without colliding with this
  existing field.
- `cssPropertyMap.ts` maps CSS `display: flex` → `display: 'flex'` and
  anything else (including `none`) → `display: 'none'` — so a CSS
  file with `display: none` today quietly parses as "not flex", not
  as invisible.
- `generateCode.ts` emits `display: <value>;` whenever
  `el.display !== DEFAULT_*_STYLES.display` — since the default is
  `'none'` it only ever emits `display: flex`. Never emits the
  literal string `display: none` today.
- `ElementRenderer.tsx` applies `display: flex` inline only when
  `el.display === 'flex'`. No opacity or visibility handling.

---

## Model changes

Add two new fields to `ScampElement`:

```ts
/**
 * CSS `opacity` as a 0..1 number. Default 1. Values outside the range
 * are clamped at the UI layer; the model trusts what it's given.
 */
opacity: number;

/**
 * Visibility state. Maps to CSS as:
 *   - 'visible' → nothing emitted (default)
 *   - 'hidden'  → `visibility: hidden;`
 *   - 'none'    → `display: none;`
 *
 * Intentionally separate from the existing `display` field, which
 * still represents flex/non-flex. When `visibilityMode === 'none'`
 * the generator omits the flex-related declarations — `display: none`
 * would override them anyway and keeping the file clean matches how
 * a human would write it.
 */
visibilityMode: 'visible' | 'hidden' | 'none';
```

Defaults in `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES`:
`opacity: 1`, `visibilityMode: 'visible'`. The generator's
"only emit deltas from the default" rule keeps clean output.

`cloneElementSubtree` carries both fields across (the spread already
handles this; no change needed).

---

## Parse → generate round-trip

### `cssPropertyMap.ts`

Two new entries plus one subtle change to the existing `display`
mapper:

```ts
opacity: (v) => {
  const n = Number(v.trim());
  if (!Number.isFinite(n)) return {};
  // Clamp — CSS accepts >1 and <0, but the typed model should stay
  // in range so the slider behaves.
  return { opacity: Math.min(1, Math.max(0, n)) };
},
visibility: (v) => {
  if (v === 'hidden') return { visibilityMode: 'hidden' };
  if (v === 'visible') return { visibilityMode: 'visible' };
  return {};
},
display: (v) => {
  if (v === 'flex') return { display: 'flex' };
  if (v === 'none') return { visibilityMode: 'none' };
  return { display: 'none' }; // existing semantics: "not flex"
},
```

Note the `display` mapper now routes `display: none` to
`visibilityMode: 'none'` instead of the existing `display: 'none'`.
That's the right mapping — today's behaviour (CSS `display: none`
silently meaning "not flex") is a latent bug this story fixes.

### `generateCode.ts`

Add emitters after the existing `display: flex` line:

```ts
// Visibility wins over flex — if the user hid the element, we
// don't emit the flex declarations that would be dead code.
if (el.visibilityMode === 'none') {
  lines.push('display: none;');
} else if (el.display === 'flex') {
  lines.push('display: flex;');
  // ...existing flex-direction, gap, align-items, justify-content...
}

if (el.visibilityMode === 'hidden') {
  lines.push('visibility: hidden;');
}

if (el.opacity !== DEFAULT_RECT_STYLES.opacity) {
  // Trim trailing zeros for readability: `opacity: 0.5` not `0.50`.
  lines.push(`opacity: ${el.opacity};`);
}
```

When `visibilityMode === 'none'`, the flex-related lines are
skipped — the internal state is preserved (so toggling Visibility
back to Visible restores flex output) but a save-then-reload while
hidden loses the latent flex settings because the CSS no longer
carries them. Acceptable trade-off: the output matches what a human
would write, and `display: none` is an edge case where the user
typically isn't actively styling the element.

### Defaults

- `opacity: 1` — generator skips emit, parser falls back.
- `visibilityMode: 'visible'` — same.

Both defaults must be added to `DEFAULT_RECT_STYLES` and
`DEFAULT_ROOT_STYLES` so existing tests that `toEqual` a full
default element keep passing after augmentation.

---

## Canvas rendering

`ElementRenderer.elementToStyle`:

- Apply `opacity: el.opacity` on every element.
- When `visibilityMode === 'hidden'`: apply literal
  `visibility: 'hidden'`. The element takes up space, is invisible,
  and is **not clickable on the canvas** — the user selects it via
  the layers panel. This matches the production behaviour a designer
  would expect.
- When `visibilityMode === 'none'`: do **not** apply `display: none`
  on the DOM node, because that would remove it from layout entirely
  and make it unselectable. Instead:
  - Apply a dim `opacity: 0.35` (independent of the user's opacity
    — we multiply so a user-set 50% becomes ~17% on the canvas).
  - Add a modifier class whose `::after` overlays a diagonal-stripe
    pattern via `repeating-linear-gradient`.
  - The element still occupies its real size + position so the
    layers panel and direct-click selection keep working.

The checkerboard/stripe overlay lives in `ElementRenderer.module.css`
as a new `.hiddenNone` class with a pseudo-element — no new DOM
nodes, no extra wrappers that would confuse the selection hit-test.

For `visibilityMode === 'hidden'` the canvas rendering is literal
(`visibility: hidden`) so what-you-see matches what-you-export. If
this proves hard to select in practice we can add the same dim+
stripe treatment later — flagged in Risks.

---

## UI — new VisibilitySection

`src/renderer/src/components/sections/VisibilitySection.tsx`.

Mounted in `UiPanel.tsx` below the appearance controls — after
`BorderSection`, before `TagSection` / `TypographySection` /
`ImageSection`. Visible for every element type (including root,
text, and image).

Controls:

- **Opacity row**: a `NumberInput` (0–100, integer, suffix `%`) side
  by side with a native `<input type="range" min="0" max="100">`.
  Changes to either sync the other; both write to the model as
  `opacity: value / 100`.
- **Visibility row**: a `SegmentedControl` with three options —
  *Visible* / *Hidden* / *None*. Writes `visibilityMode`.

### Interaction with the Layout section

Per the backlog, when `visibilityMode === 'none'` the Layout
section's display toggle (Block / Flex) is disabled. Implementation:

- `LayoutSection` already reads `element` from the store; add a
  `const disabled = element.visibilityMode === 'none'` gate around
  the display `SegmentedControl`.
- The other Layout fields (direction, align, justify, gap) also
  disable — they're meaningless when `display: none`.
- A `Tooltip` on the disabled row explains *"Layout is disabled
  while Visibility is set to None — the element is removed from the
  page."* Matches how other disabled controls surface the reason.

---

## Tests

New unit tests (`test/`):

- `cssPropertyMap.test.ts` — extend:
  - `opacity: 0.5` → `{ opacity: 0.5 }`, `opacity: 1.5` clamps to 1,
    `opacity: foo` → `{}` no-op, decimal and integer forms.
  - `visibility: hidden` / `visibility: visible` round-trips.
  - `display: none` now routes to `visibilityMode: 'none'`.
  - `display: flex` still routes to `display: 'flex'` (existing).

- `generateCode.test.ts` — extend:
  - Opacity 1 → no emit; 0.5 → `opacity: 0.5;`.
  - `visibilityMode: 'hidden'` → emits `visibility: hidden;`.
  - `visibilityMode: 'none'` → emits only `display: none;`, skips
    any flex-related declarations even if `display === 'flex'`.
  - Default visibility → no emit.

- `parseCode.test.ts` — existing round-trip test must still pass
  unchanged with the new fields defaulted into the element.

- `defaults.test.ts` — confirm `DEFAULT_RECT_STYLES.opacity === 1`
  and `visibilityMode === 'visible'`.

No integration tests — the round-trip tests cover the new
properties through the full pipeline.

---

## Implementation phases

### 1. Model + defaults

Add `opacity` and `visibilityMode` to `ScampElement` and both
DEFAULT_*_STYLES. Update any element-construction sites that spread
partial defaults (the group factory in `element.ts`, rectangle /
text / image creation in the canvas slice).

### 2. Parser + generator

Update `cssPropertyMap.ts`, `generateCode.ts`, and the corresponding
tests. Confirm the round-trip test still passes.

### 3. Canvas render

Apply opacity + visibility on the rendered element. Add the
`hiddenNone` modifier class with the stripe overlay.

### 4. VisibilitySection + UiPanel wiring

Build the section, mount it, wire controls.

### 5. Layout section gate

Disable the display toggle + related fields when visibility is
none; add the tooltip.

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | Add `opacity` and `visibilityMode` to `ScampElement` |
| `src/renderer/lib/defaults.ts` | Add defaults for both fields |
| `src/renderer/lib/cssPropertyMap.ts` | Add `opacity` + `visibility` entries; route `display: none` to `visibilityMode` |
| `src/renderer/lib/generateCode.ts` | Emit new declarations; skip flex emits when hidden-none |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Apply opacity + visibility; add `hiddenNone` class |
| `src/renderer/src/canvas/ElementRenderer.module.css` | New `.hiddenNone::after` stripe overlay |
| `src/renderer/src/components/sections/VisibilitySection.tsx` | New section |
| `src/renderer/src/components/sections/VisibilitySection.module.css` | New |
| `src/renderer/src/components/sections/LayoutSection.tsx` | Disable when visibilityMode === 'none' |
| `src/renderer/src/components/UiPanel.tsx` | Mount VisibilitySection |
| `src/renderer/store/canvasSlice.ts` | Populate new defaults on element create (rect / text / image) |
| `test/cssPropertyMap.test.ts` | New cases |
| `test/generateCode.test.ts` | New cases |
| `test/defaults.test.ts` | Check new defaults |

---

## Out of scope

- Animating visibility transitions on canvas (fade-in/out). The
  canvas renders the final state only.
- Hiding/showing from the layers panel via an eye-icon toggle. A
  nice follow-up but separate UX.
- Keyboard shortcut for toggle-hide (Figma's Shift+Cmd+H). Easy
  add after this ships.
- `display: contents`, `display: inline`, `display: grid` — the
  existing `display` field stays binary (flex / non-flex).
  Expanding that is a different story.

---

## Risks

- **Latent flex state on save-reload when hidden-none.** Described
  above. Worst case: user hides an element, saves, reloads, unhides
  — flex container setup comes back as defaults. Acceptable; the
  output CSS is still correct.

- **`visibility: hidden` makes the element unclickable on canvas.**
  We chose literal CSS for fidelity, trading off selection ergonomics.
  If users report frustration we can add the same dim+stripe
  treatment the `none` state gets. Easy follow-up.

- **Agent-written opacity values in `customProperties`.** Existing
  projects have CSS like `opacity: 0.7` landing in `customProperties`.
  After this lands, the parser will route those to the typed field —
  first read of an existing file migrates them for free. The
  regenerated CSS will still emit `opacity: 0.7;` so the file stays
  byte-similar.

- **Existing CSS with literal `display: none`.** Before this story,
  `cssPropertyMap` silently mapped `display: none` → "not flex" (a
  no-op for state, but also a lost declaration on generate). After,
  it correctly sets `visibilityMode: 'none'` and the generator emits
  `display: none;` back. Net: existing `display: none` in files now
  round-trips correctly. Migration is invisible to users.

- **Range slider precision.** Storing opacity as a float (e.g.,
  `0.37`) but showing it as integer-percent (`37%`) introduces tiny
  rounding errors on round-trip. The UI does `value / 100` one way
  and `Math.round(value * 100)` back. Acceptable — matches every
  other design tool. Cover in a test.
