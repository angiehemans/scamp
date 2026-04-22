# Properties Panel

The properties panel is on the right side of the screen. It shows editable properties for the selected element. It has two modes, toggled at the top: **Visual** and **CSS**.

## Visual Mode

Visual mode organizes properties into collapsible sections. Only sections relevant to the selected element type are shown (for example, text elements do not show Layout; image elements do not show Background Color).

### Element

The collapsible **Element** section at the top lets you change the HTML tag used for the selected element and edit tag-specific attributes (e.g. `href` on a link, `controls` on a video, `placeholder` on an input). Full details in [Elements](elements.md).

### Size

- **W** (width) and **H** (height) number inputs.
- Each dimension has a mode selector: **Fixed**, **Stretch**, **Hug**, or **Auto**.

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

### Visibility

- **Opacity** — 0–100% number input.
- **Display** — Visible / Hidden / None segmented control.

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

## Tips

- Use Visual mode for quick adjustments, CSS mode for precise control.
- See [Typography](typography.md) for text-specific properties.
- See [Elements](elements.md) to change an element's semantic HTML tag.
