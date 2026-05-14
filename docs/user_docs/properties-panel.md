# Properties Panel

The properties panel is on the right side of the screen. It shows editable properties for the selected element. It has two modes, toggled at the top: **Visual** and **CSS**.

## Visual Mode

Visual mode organizes properties into collapsible sections. Only sections relevant to the selected element type are shown (for example, text elements do not show Layout; image elements do not show Background Color).

### Element

The collapsible **Element** section at the top lets you change the HTML tag used for the selected element and edit tag-specific attributes (e.g. `href` on a link, `controls` on a video, `placeholder` on an input). Full details in [Elements](elements.md).

### Size

- **W** (width) and **H** (height) inputs accept any CSS length:
  - `100` (treated as `100px`), `100px` → **Fixed**
  - `100%` → **Stretch**
  - `auto` → **Auto**
  - `fit-content` → **Hug**
  - `100vh`, `100vw`, `2em`, `calc(100% - 20px)`, `var(--page-w)` →
    **Fixed** with the verbatim value preserved
- The mode selector (**Fixed** / **Stretch** / **Hug** / **Auto**)
  auto-syncs with whatever you typed — `100%` flips to Stretch,
  `auto` flips to Auto, etc. You can also pick the mode manually
  from the dropdown.

### Layout

- Toggle between **Block** and **Flex** display.
- For flex containers: **Direction** (row/column), **Align**, **Justify**, and **Gap**.

### Spacing

- **P** (padding) and **M** (margin) inputs.
- Supports shorthand input: type `10` for uniform, `10 20` for vertical/horizontal, or `10 20 30 40` for top/right/bottom/left.

### Background

- Color swatch button that opens the [Color Picker](color-picker.md).
- Set a background image via "Set background image"; adjust size, position, and repeat from inline controls.

### Border

- **Color** swatch, **Style** selector (solid, dashed, etc.), **W** (width), **R** (border-radius).
- Supports shorthand input for radius (e.g. `10 20 10 20`).

### Shadow

- "+ Add shadow" appends a row. Multiple shadows are supported and
  emit as a comma-separated `box-shadow` value.
- Per row: **X / Y** offsets, **B** (blur), **S** (spread), color
  picker, **O** (opacity 0–100%), and an **Outset / Inset** toggle.
- Color and opacity are split for clarity — the picker writes a hex
  base color; the **O** input controls the alpha. The combined
  output is always `rgba(...)`.
- The remove button (×) drops a single row; setting the section
  empty drops the entire `box-shadow` declaration.

### Filters

- A row of CSS `filter` functions applied in order: blur,
  brightness, contrast, grayscale, hue-rotate, invert, opacity,
  saturate, sepia.
- "+ Add filter" appends a row. Each row has a kind dropdown and
  a numeric value input with the right unit suffix (px, %, deg).
- "Backdrop filter" toggle opens a second row of filters that
  apply to the content **behind** the element via
  `backdrop-filter`. Visible only when the element has a
  partially transparent background.
- Full details in [Filters](filters.md).

### Visibility

- **Opacity** — 0–100% number input.
- **Display** — Visible / Hidden / None segmented control.
- **Blend** — `mix-blend-mode` dropdown. Default is **Normal**
  (no declaration emitted). Options group by category: Darken
  (Multiply / Darken / Color burn), Lighten (Screen / Lighten /
  Color dodge), Contrast (Overlay / Soft light / Hard light),
  Inversion (Difference / Exclusion), and Component (Hue /
  Saturation / Color / Luminosity).

### Transitions, Animation

See [Transitions](transitions.md) and [Animations](animations.md) for the
shorthand-emitting Transitions section and the preset-driven
Animation section.

### Export

The **Export** section sits at the bottom of the WYSIWYG panel
(Figma-style) and writes a PNG or SVG of the selected element.

- **Format** dropdown: PNG or SVG.
- **Scale** (PNG only): 1× / 2× / 3× — multiplies the captured
  pixel resolution.
- **Size** read-out: live width × height of the export target.
- The Export button label updates with scope ("Export rect_a1b2"
  for an element, "Export page" for the page root).
- Clicking opens a native save dialog. The renderer captures the
  DOM via `html-to-image`; main writes the bytes.
- Editor chrome (selection outlines, drop indicators, the
  CanvasInteractionLayer) is filtered out of every capture.

## CSS Mode

Switches the panel to a raw CSS editor powered by CodeMirror. Edit any CSS property directly.

- Changes commit when you click away (blur) or press **Cmd+S**.
- Unknown properties are preserved through round-trips as custom properties.
- When a non-desktop breakpoint is active, the editor scopes to that breakpoint's `@media` block — see [Breakpoints](breakpoints.md).

## Editing at a Breakpoint

When the canvas is at a non-desktop breakpoint (Mobile, Tablet, or a custom one you've defined), field edits land in that breakpoint's override instead of the base CSS.

- Sections with overrides show a small **blue dot** next to the section title. Hover the dot for a tooltip listing every CSS property overridden at the active breakpoint in that section.
- **Right-click** the dot to reset every overridden field in that section — each field reverts to the cascade value from desktop (or a wider breakpoint).

See [Breakpoints](breakpoints.md) for a complete walkthrough.

## Duplicate-CSS Indicator

When the parser sees the same CSS property declared more than once in
an element's class block (e.g. `height: 100%; height: 100vh;`), the
section that owns that property surfaces a small **yellow dot** next
to its title. Hover for a tooltip listing the duplicated property.

Duplicates usually come from agent-written or hand-edited CSS where
two values landed for the same property. The browser cascade picks
the last-declared value; Scamp's typed state reflects the same.

**The dot self-heals when you edit any field on the affected
element**: editing rewrites the rule block from typed state, which
collapses the duplicates. Existing fallback patterns (e.g. `display:
-webkit-box; display: flex;`) are flattened to the modern value on
this rewrite — back up the file first if you want to keep the
fallback.

## Tips

- Use Visual mode for quick adjustments, CSS mode for precise control.
- See [Typography](typography.md) for text-specific properties.
- See [Elements](elements.md) to change an element's semantic HTML tag.
