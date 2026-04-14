# Properties Panel

The properties panel is on the right side of the screen. It shows editable properties for the selected element. It has two modes, toggled at the top: **Visual** and **CSS**.

## Visual Mode

Visual mode organizes properties into collapsible sections. Only sections relevant to the selected element type are shown (for example, text elements do not show Layout).

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

### Border

- **Color** swatch, **Style** selector (solid, dashed, etc.), **W** (width), **R** (border-radius).
- Supports shorthand input for radius (e.g. `10 20 10 20`).

## CSS Mode

Switches the panel to a raw CSS editor powered by CodeMirror. Edit any CSS property directly.

- Changes commit when you click away (blur) or press **Cmd+S**.
- Unknown properties are preserved through round-trips as custom properties.

## Tips

- Use Visual mode for quick adjustments, CSS mode for precise control.
- See [Typography](typography.md) for text-specific properties.
