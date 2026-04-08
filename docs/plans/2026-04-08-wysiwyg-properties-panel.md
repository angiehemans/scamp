# WYSIWYG Properties Panel — Plan

**Status:** Draft, awaiting user review. Do not implement until approved.
**Date:** 2026-04-08

## Goal

Replace the CSS-only properties panel with a dual-mode panel: a friendly UI
view with typed controls for the most common CSS properties, plus the existing
raw CSS view for power users. The user can toggle between them. Both views
read and write the same underlying element state, so flipping is instant and
lossless.

## Why now

The current panel has a single mode — a CodeMirror raw CSS editor. It's
powerful but assumes the user knows CSS by heart. The element store already
has typed fields for most common style properties (`backgroundColor`,
`borderRadius`, `display`, `flexDirection`, `gap`, `padding`, `fontSize`,
etc.) and a `patchElement(id, patch)` action ready to receive updates from
typed UI controls. Wiring those fields to real form widgets is the
last-mile work that turns scamp into something a non-CSS-fluent designer can
actually use.

---

## Scope

### In scope (this plan)

- A new **UI mode** for the properties panel with grouped form controls.
- A **toggle** at the top of the panel to switch between UI mode and the
  existing CSS mode. Both modes read the same store, so changes made in one
  mode are immediately visible in the other.
- Typed fields and round-trip support for **`margin`**, **`line-height`**,
  and **`letter-spacing`** — currently they live in `customProperties` but
  the user wants them as first-class controls.
- A **tag selector** for text elements (`h1`–`h6`, `p`, `span`, etc.) since
  semantic tags are now stored on the element.
- Sensible **per-element-type** sections — root, rectangles, and text each
  get the controls that apply to them and nothing they don't.

### Out of scope (intentionally deferred)

- Color picker beyond the native `<input type="color">`. No eyedropper, no
  swatch palette, no recent-colors list.
- Per-side border controls. Border is uniform (one width, one style, one
  color); per-side border is a follow-up.
- Per-corner border-radius. One radius for all four corners.
- Box shadow, transform, transition, filter, gradient, and animation
  controls. These continue to round-trip through `customProperties` and
  render correctly on the canvas, just with no UI.
- Multi-select editing of typed fields. When more than one element is
  selected, the UI panel shows the primary's values and edits land on the
  primary only — same behavior as the current CSS panel.
- Undo/redo. Out of POC scope per the original PRD.
- Responsive / breakpoint controls.
- Pseudo-classes (`:hover`, `:focus`).
- Drag handles on number inputs (Photoshop-style scrubbing).

---

## Data-model changes

Three new typed fields land on `ScampElement` so the panel can offer real
controls instead of stuffing them into `customProperties`:

| Field            | Type                                       | Default | Notes                                                       |
| ---------------- | ------------------------------------------ | ------- | ----------------------------------------------------------- |
| `margin`         | `[number, number, number, number]`         | `[0,0,0,0]` | Same shape as existing `padding`. Top/right/bottom/left.   |
| `lineHeight`     | `number \| undefined`                      | `undefined` | Unitless multiplier (e.g. `1.5`). Text only; rect ignores. |
| `letterSpacing`  | `number \| undefined`                      | `undefined` | px. Text only; rect ignores.                                |

### Mapper updates (`cssPropertyMap.ts`)

- New `margin` shorthand mapper that uses the existing `parsePaddingShorthand`
  helper (the algorithm is identical for the four-side margin form).
- New per-side longhand mappers: `margin-top`, `margin-right`, `margin-bottom`,
  `margin-left` — each writes one element of the tuple.
- New `line-height` mapper. Accepts a unitless number. (No `px` form for POC.)
- New `letter-spacing` mapper. Accepts a px value.

### Generator updates (`generateCode.ts`)

- `elementDeclarationLines` emits `margin` (4-value shorthand) when any side
  is non-zero. Same conditional pattern as `padding`.
- For text elements, also emits `line-height` and `letter-spacing` when set.

### Parser updates (`parseCode.ts`)

- No structural changes — the existing `applyDeclarations` already routes
  any property in `cssToScampProperty` to its mapper. Just adding mappers
  above is enough.

### Defaults updates (`defaults.ts`)

- `DEFAULT_RECT_STYLES.margin` = `[0, 0, 0, 0]`.
- `DEFAULT_ROOT_STYLES.margin` = `[0, 0, 0, 0]`.
- No defaults for `lineHeight` / `letterSpacing` — they're optional and
  text-only, like the existing `fontSize` / `fontWeight` / `color` /
  `textAlign`.

### Store updates

- `makeRectangle` and `makeText` in `canvasSlice.ts` set
  `margin: [0, 0, 0, 0]`.
- No new store actions — the existing `patchElement(id, patch)` is exactly
  the right shape for typed controls. Each control reads from the store via
  `useCanvasStore` and writes via `patchElement`.

---

## UI design

### Toggle

Top of the panel, right under the existing class-name chip header:

```
┌────────────────────────────┐
│ Class .rect_a1b2  +1 more  │
├────────────────────────────┤
│   [ UI ]    CSS            │   ← segmented toggle, UI active
├────────────────────────────┤
│ … control sections …       │
```

- Segmented control with two options: **UI** (default) and **CSS**.
- The selection is stored on the canvas store as `panelMode: 'ui' | 'css'`
  so it persists across selection changes within a session.
- Switching modes doesn't write anything — both modes read the same element
  state. Instant flip.

### Section structure (rectangles)

Sections are vertical cards stacked in the panel. Each section has a small
heading and 1–4 controls. The full ordering for a non-root rectangle:

1. **Position** — only when the parent is non-flex. Two number inputs (`x`, `y`).
2. **Size** — width and height. Each row has a mode dropdown (`Fixed`, `Stretch`, `Fit content`, `Auto`) and a px number input that's only enabled when the mode is `Fixed`.
3. **Layout** — display switcher (`Block` / `Flex`). When `Flex`:
   - direction segmented control: `→ Row` / `↓ Column`
   - align-items dropdown: `Start`, `Center`, `End`, `Stretch`
   - justify-content dropdown: `Start`, `Center`, `End`, `Space between`, `Space around`
   - gap number input
4. **Spacing** — padding and margin. Each is a four-side input with a "linked" toggle (single value applies to all four sides) and an "expanded" mode (four separate inputs). Default: linked.
5. **Background** — native color picker plus a hex text field that mirrors it.
6. **Border** — width number input, style dropdown (`None`, `Solid`, `Dashed`, `Dotted`), color picker (hex), and a separate `Radius` number input below.

### Section structure (text)

Text elements get all of the rectangle sections **plus**:

7. **Tag** — dropdown with `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `span`, `a`, `label`, `strong`, `em`. Default `p`. Updates `el.tag` via `patchElement`. (`undefined` is stored when the user picks the type's default, matching `parseCode`'s storage rule.)
8. **Typography** —
   - font-size number input (px)
   - font-weight dropdown: `400 Regular`, `500 Medium`, `600 Semibold`, `700 Bold`
   - color picker + hex
   - text-align segmented control: `Left`, `Center`, `Right`
   - line-height number input (unitless decimal)
   - letter-spacing number input (px, can be negative)

### Section structure (root)

The page root is a special case. Sections it shows:

- **Page size** — width number input, `min-height` number input. (Note: emits `min-height` per the existing root rule.)
- **Background** — same as rect.
- **Layout** — same as rect (so the page can be a flex column, etc.)
- **Spacing** — padding only (no margin on the page itself).

Hidden for root: position, border (could be added later), per-side margin,
size mode (root is always Fixed-width / min-height growable).

### Sections shown by element type

| Section     | Root | Rect | Text |
| ----------- | ---- | ---- | ---- |
| Position    |      | ✅¹  | ✅¹  |
| Size        | ✅²  | ✅   | ✅   |
| Layout      | ✅   | ✅   | ✅   |
| Spacing     | ✅³  | ✅   | ✅   |
| Background  | ✅   | ✅   | ✅   |
| Border      |      | ✅   | ✅   |
| Tag         |      |      | ✅   |
| Typography  |      |      | ✅   |

¹ Only when the element's parent is non-flex.
² "Page size" — width + min-height, no mode selector.
³ Padding only.

---

## Component architecture

```
PropertiesPanel.tsx              (existing — becomes the router)
├── PanelHeader.tsx               class chip + multi-select badge
├── PanelModeToggle.tsx           [UI / CSS] segmented control
├── UiPanel.tsx                   the new typed view
│   ├── PositionSection.tsx
│   ├── SizeSection.tsx
│   ├── LayoutSection.tsx
│   ├── SpacingSection.tsx
│   ├── BackgroundSection.tsx
│   ├── BorderSection.tsx
│   ├── TagSection.tsx           (text only)
│   └── TypographySection.tsx    (text only)
└── CssPanel.tsx                 (existing — extracted from PropertiesPanel
                                 so the router stays small)
```

Each section component is small (one concern) and reads its slice of the
store via a focused selector. Each section composes generic controls from a
shared `controls/` directory:

```
src/renderer/src/components/controls/
├── NumberInput.tsx               px number with stepper buttons
├── ColorInput.tsx                native color + hex
├── EnumSelect.tsx                <select> styled to match dark theme
├── SegmentedControl.tsx          two/three-button toggle
├── FourSideInput.tsx             linked / expanded 4-value editor
└── ToggleRow.tsx                 a single labeled boolean
```

These controls are pure leaf components — they take a `value` and an
`onChange`, and have no knowledge of the canvas store or element model.
Section components are the glue that wires them to `patchElement`. This
isolation makes the controls trivially testable and reusable.

### Wiring to the store

Each control's onChange handler calls `patchElement(id, partial)` with just
the field that changed. Example (`SizeSection`):

```ts
const setWidthMode = (mode: WidthMode) =>
  patchElement(id, { widthMode: mode });
const setWidthValue = (px: number) =>
  patchElement(id, { widthMode: 'fixed', widthValue: px });
```

Switching to fixed mode is implicit when the user types into the number input
— exactly the same UX as dragging a resize handle.

The existing `syncBridge` already debounces store changes and writes to disk.
**No new IPC channels are needed.** The UI panel and the existing CSS panel
both end up writing files via the same path; the only difference is the UI
panel writes typed fields directly while the CSS panel commits raw CSS via
`file:patch`.

### Selection & multi-select

For now, the UI panel always edits **the primary selected element**
(`selectedElementIds[0]`) — same as the CSS panel. The header still shows
the `+N more` badge so the user knows other elements are selected. Multi-edit
is deferred.

---

## Toggle persistence

`canvasSlice.panelMode: 'ui' | 'css'`, default `'ui'`. Stored in the canvas
store next to `bottomPanel`. Survives selection changes and project reloads
during the session, but not across app restarts (no file persistence) — same
treatment as `bottomPanel` and `userZoom`.

---

## Edge cases

- **Switching mode mid-edit in the CSS panel.** When the user has a dirty
  draft in the CSS view and clicks the UI tab, the CSS view's existing
  blur-flushes-to-disk path runs first. The UI view then loads from the
  freshly-written state via the standard parseCode round-trip.
- **Element disappears while being edited.** Same as today — the panel
  shows the placeholder when `selectedElementIds` becomes empty, and the
  per-section selectors return `undefined` and bail.
- **Root with display:flex.** The flex section appears for root just like
  for rects. The position section is always hidden for root (root is the
  page frame, not positioned).
- **Numeric input parsing.** All number inputs accept integers and clamp at
  reasonable bounds (gap ≥ 0, font-size ≥ 1, padding ≥ 0). Invalid input
  reverts to the previous value on blur.
- **Color input.** The native `<input type="color">` only accepts `#rrggbb`
  format. Element fields can hold any CSS color string (e.g.
  `rgba(0,0,0,0.5)`, `red`, `transparent`). When the stored value isn't
  parseable as `#rrggbb`, the color picker shows black and a small note
  "Edit in CSS view to use named or rgba colors."
- **Undefined optional text fields.** `lineHeight` is optional. The number
  input shows the placeholder `auto` when undefined. Typing a number sets
  the field; clearing the input writes `undefined`.

---

## Test plan

### Unit tests (new)

- **`margin` mapper** — same coverage as `padding` (1/2/3/4-value shorthand,
  empty input, longhand sides).
- **`line-height` mapper** — accepts decimal, parses through, rejects px form.
- **`letter-spacing` mapper** — px value, negative px, empty input.
- **`generateCode`** — emits `margin` shorthand only when non-zero, emits
  `line-height` and `letter-spacing` only when set on text elements.
- **Round-trip** — extend `sync.integration.test.ts` with a tree that uses
  margin / line-height / letter-spacing and confirm `parseCode →
  generateCode → parseCode` is stable.

### Component tests (new — light)

- **`FourSideInput`** — linked mode emits one value to all four sides;
  expanded mode emits one value at a time.
- **`NumberInput`** — clamps below minimum, reverts on invalid input.
- **`EnumSelect`** — value → onChange roundtrip.

### Manual / integration

- Load the user's existing test project (the one Claude built). The UI panel
  should show the typed values for every property the agent wrote — including
  the new margin / line-height / letter-spacing fields, which should no
  longer appear under the legacy `customProperties` bag.
- Toggle between UI and CSS panel mid-edit. Confirm both views stay in sync.
- Edit a value in the UI panel, switch to CSS, see the new value in the
  generated CSS. Edit in CSS, switch back, see the new value in the UI.

---

## Implementation phases

The work breaks naturally into three phases, each merge-safe on its own:

### Phase 1 — Data model expansion

1. Add `margin`, `lineHeight`, `letterSpacing` to `ScampElement`.
2. Add the four mappers to `cssPropertyMap.ts`.
3. Update `generateCode.ts` to emit them.
4. Update default constants and `makeRectangle` / `makeText`.
5. Add unit tests for the new mappers + generator emission.
6. Add a round-trip integration test that exercises all three new fields.
7. **Acceptance:** existing tests pass, new tests pass, files with margin /
   line-height / letter-spacing now round-trip into typed fields instead of
   `customProperties`.

### Phase 2 — Generic controls + section scaffolding

1. Add `panelMode` to canvas store, default `'ui'`. Add `setPanelMode`.
2. Create the `controls/` directory with the leaf components: `NumberInput`,
   `ColorInput`, `EnumSelect`, `SegmentedControl`, `FourSideInput`, `ToggleRow`.
3. Refactor `PropertiesPanel.tsx` into a router that renders `PanelHeader`,
   `PanelModeToggle`, and either `UiPanel` or `CssPanel`. Move the existing
   CodeMirror code into `CssPanel.tsx`.
4. Create empty `UiPanel.tsx` that renders a "coming soon" placeholder.
5. **Acceptance:** the toggle works, the existing CSS view still functions
   as today, no functional regression.

### Phase 3 — Section components

Build sections one at a time, in this order (each gets its own commit):

1. `BackgroundSection` — simplest, single control.
2. `SpacingSection` — uses `FourSideInput`, validates the linked/expanded UX.
3. `BorderSection`.
4. `SizeSection` — width/height with mode dropdowns.
5. `LayoutSection` — display toggle, conditional flex sub-controls.
6. `PositionSection` — only renders for absolute children.
7. `TagSection` (text only).
8. `TypographySection` (text only).

After each section: visually verify against the user's existing test project,
make sure the round-trip stays stable, then move on.

**Acceptance for the whole feature:** every CSS property the user listed
("layout, background, border, padding, margin, font-size, font-weight,
color, text-align, line-height") is editable from the UI panel without ever
typing CSS, AND the CSS view shows what the UI changes wrote, AND the user's
agent-built file from earlier in the session round-trips through both views
unchanged.

---

## Open questions

1. **Color input format for non-hex values.** The plan is to fall back to
   "Edit in CSS view" when the stored color isn't `#rrggbb`. Is that
   acceptable, or should we add a small text-input fallback alongside the
   color picker so users can type `rgba(...)` directly?
2. **Font weight enum vs free input.** The plan locks font-weight to four
   discrete values (400/500/600/700) since those are the only ones the
   typed `fontWeight` field accepts today. Should we widen the type to
   `100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900` so the dropdown
   can include thin/light/black?
3. **Border per-side.** Currently border is uniform. Adding per-side
   controls is a real model expansion (`borderTopWidth`, etc.) — out of
   scope for this plan, but worth confirming we agree to defer it.
4. **Margin on root.** The plan hides margin from the root section since
   the page frame doesn't sit inside another box on disk. Confirm this is
   the right call.
5. **Number input scrubbing.** Some design tools let you click-and-drag a
   number input label to scrub the value. Nice but complex — currently out
   of scope. Want it added back?

---

## Risk & mitigation

- **Risk:** The UI panel and CSS panel get out of sync, e.g. the UI panel
  sets a typed field that the generator doesn't emit, so the CSS view shows
  stale content.
  **Mitigation:** Both views read the same store. The CSS view's editor
  body is always derived from `elementDeclarationLines(element)` — i.e.,
  whatever the generator would write. As long as every typed field has a
  matching emit branch in `generateCode`, they can never drift. The phase 1
  unit tests lock this in.

- **Risk:** Adding `margin` to the model changes how older files round-trip
  (they previously had margin in `customProperties`).
  **Mitigation:** This is the desired change. After phase 1, files load
  margin into the typed field instead of the bag. The custom-properties
  inline-style application still works for everything else. A short note in
  the changelog (if we had one) would help, but for POC the parser change
  is sufficient.

- **Risk:** The first-pass section UI looks ugly compared to Figma / Webflow
  / Framer.
  **Mitigation:** Accept it. The point of this phase is functional parity,
  not pixel polish. Once the structure is in place, restyling is cheap.

---

## What success looks like

After this work lands, a user can:

1. Click any rectangle on the canvas.
2. See the UI panel populate with the rectangle's current values across the
   six sections.
3. Adjust any of those values without typing CSS — change the background
   color via a color picker, set padding to 24 px on all sides via a
   linked-mode four-side input, toggle display to flex and pick a direction.
4. Watch the canvas update live with each adjustment.
5. Toggle to CSS view and see the same values reflected as raw declarations.
6. Toggle to a text element and see the typography section appear, with a
   font-size input, font-weight dropdown, line-height field, etc.
7. Pick a semantic tag (`h1`) from the tag dropdown and watch the canvas
   re-render the element as a real `<h1>`.

…and at no point does any of this break the existing CSS-panel workflow,
the file round-trip, or the agent.md contract.
