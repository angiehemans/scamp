# Color Picker Upgrade — Plan

**Status:** Draft, awaiting user review. Do not implement until approved.
**Date:** 2026-04-09

## Goal

Replace the native `<input type="color">` with a dark-mode SketchPicker from
`react-color` that supports both hex and rgba. Users should be able to pick
colors with an alpha channel directly from the UI panel without switching to
the CSS view.

---

## Current state

- `ColorInput.tsx` renders a native `<input type="color">` (hex only, no
  alpha) plus a text field that mirrors it.
- When the stored color isn't `#rrggbb` (e.g. `rgba(...)`, `transparent`,
  `red`), the swatch falls back to black and a hint says "Edit in CSS view."
- The element model already stores colors as arbitrary strings (`backgroundColor`,
  `borderColor`, `color`). `generateCode` emits them as-is, `parseCode` reads
  them as-is. **No data model changes are needed for rgba.**
- `ColorInput` is used in three sections: BackgroundSection, BorderSection,
  TypographySection. All share the same `{ value: string; onChange: (string) => void }` interface.

---

## Approach

### Install `react-color`

```bash
npm install react-color
npm install -D @types/react-color
```

The package is 2.19.3 (stable, maintenance-mode, works with React 18).
Justified: a proper color picker with saturation area + hue bar + alpha
slider + preset swatches is not a 20-line utility.

### Replace `ColorInput` internals

The new `ColorInput` wraps the `SketchPicker` from react-color. The
component's external interface (`value: string`, `onChange: (string) => void`)
stays exactly the same — no changes needed in BackgroundSection,
BorderSection, or TypographySection.

### Interaction model

- A small **color swatch button** shows the current color (including
  alpha, rendered as a checkerboard-behind-color pattern).
- Clicking the swatch opens a **popover** containing the SketchPicker.
- Clicking outside the popover or pressing Escape closes it.
- The picker fires `onChangeComplete` (not `onChange`) so the store is
  updated only when the user finishes dragging, avoiding a flood of
  `patchElement` calls during drag.
- A text input next to the swatch still shows the raw color string so
  the user can type hex/rgba directly.

### Color format emitted

- When alpha = 1 → emit `#rrggbb` (keeps CSS clean for the common case).
- When alpha < 1 → emit `rgba(r, g, b, a)`.
- The text input accepts any CSS color string and passes it through
  unchanged (same as today).

### Parsing incoming values

The SketchPicker's `color` prop accepts hex strings and `{ r, g, b, a }`
objects. To feed it the stored value:

- If the value matches `#rrggbb` or `#rgb` → pass as-is (SketchPicker
  handles hex natively).
- If the value matches `rgba(r, g, b, a)` → parse into `{ r, g, b, a }`
  and pass the object.
- If the value matches `rgb(r, g, b)` → parse into `{ r, g, b, a: 1 }`.
- Otherwise (named colors like `red`, `transparent`, or anything exotic)
  → pass the string anyway; SketchPicker falls back gracefully, and the
  text input still shows the raw value so the user isn't locked out.

A small `parseColorForPicker(value: string): string | RGBColor` utility
handles this. Lives in `ColorInput.tsx` — no new file needed, it's ~15
lines.

### Dark-mode styling

The SketchPicker ships with a white background. We override via the
`styles` prop (react-color's intended customization API):

| Sub-component | Override |
|---|---|
| `picker`       | `background: #1f1f1f`, `boxShadow: none`, `border: 1px solid #2c2c2c`, `borderRadius: 6px` |
| `color` / `activeColor` | Matches existing `.colorSwatch` styling |
| Input labels   | `color: #888` |
| Input fields   | `background: #0f0f0f`, `color: #e0e0e0`, `border: 1px solid #2c2c2c` |

These overrides go in a `DARK_SKETCH_STYLES` constant inside `ColorInput.tsx`.

### Preset colors

Pass a small curated set of 8–10 common UI colors (transparent, white,
black, a few greys, blue, red, green, amber) as `presetColors` so the
user can one-click common picks. Customizable later.

### Popover positioning

The popover renders as an absolutely-positioned div anchored below the
swatch button. CSS in `Controls.module.css`:

```css
.colorPopover {
  position: absolute;
  z-index: 10;
  top: 100%;
  left: 0;
  margin-top: 4px;
}

.colorPopoverBackdrop {
  position: fixed;
  inset: 0;
  z-index: 9;
}
```

The invisible backdrop catches clicks outside the picker and closes it.

---

## Scope

### In scope

- Replace native `<input type="color">` with SketchPicker popover.
- Dark-mode styling to match the rest of the panel.
- Emit `rgba(r,g,b,a)` when alpha < 1, `#rrggbb` when alpha = 1.
- Parse incoming hex / rgb / rgba strings to feed the picker.
- Preset color swatches.
- Text input for manual typing (hex, rgba, named colors).

### Out of scope

- Eyedropper tool.
- Recent-colors / saved-colors list.
- HSL input mode (SketchPicker shows it but we won't add extra UI for it).
- Per-section custom preset palettes (one shared set for now).

---

## Files changed

| File | Change |
|---|---|
| `package.json` | Add `react-color`, `@types/react-color` |
| `src/renderer/src/components/controls/ColorInput.tsx` | Rewrite internals: swatch button + popover + SketchPicker + text input |
| `src/renderer/src/components/controls/Controls.module.css` | Add `.colorPopover`, `.colorPopoverBackdrop`, update `.colorSwatch` for checkerboard |

**No other files change.** The three sections that use `ColorInput` keep
their existing code — the component interface is unchanged.

---

## Test plan

### Manual

- Open the UI panel, click a color swatch → picker opens below it.
- Pick a solid color → swatch and text input update, value is `#rrggbb`.
- Drag the alpha slider → value changes to `rgba(r,g,b,a)`.
- Click outside → picker closes.
- Press Escape → picker closes.
- Type `rgba(255,0,0,0.5)` in the text input, blur → swatch shows
  semi-transparent red, picker (when reopened) shows alpha at 0.5.
- Type `transparent` → swatch shows checkerboard, picker shows alpha 0.
- Toggle to CSS view → see the rgba value in the generated CSS.
- Toggle back → picker reads it correctly.

### Unit (optional follow-up)

- `parseColorForPicker` returns correct object for hex, rgb(), rgba(),
  and falls back to string for named/unknown values.

---

## Risk

- **react-color is in maintenance mode (last release 2021).** It works
  with React 18 and Electron's Chromium. If it breaks in a future React
  upgrade, the fix is to swap the import for a maintained fork
  (`@uiw/react-color` or similar) — the `styles` prop API is the same.

- **Popover can clip at panel edge.** The properties panel is 320px
  wide; the SketchPicker default is 200px. It fits. If the panel is ever
  narrower, the picker's `width` prop can be reduced.
