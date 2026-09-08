# Code output

Scamp generates real, production-ready code files as you design.

## What Scamp generates

Each page produces two files:

- `pagename.tsx`: A React component with JSX markup.
- `pagename.module.css`: A CSS Module with scoped class names.

### TSX structure

```tsx
<div data-scamp-id="root" className={styles.root}>
  <nav data-scamp-id="rect_a1b2" className={styles.rect_a1b2}>
    <a
      data-scamp-id="text_l1n2"
      className={styles.text_l1n2}
      href="/about"
      target="_self"
    >
      About
    </a>
  </nav>
</div>
```

- Each element gets a `data-scamp-id` attribute that matches its CSS
  class name.
- Class names follow the pattern `prefix_shortid`, where the prefix is
  `rect_`, `text_`, `img_`, or `input_`.
- The HTML tag is whatever you chose in the Element section; Scamp emits
  it directly. See [Elements](elements.md).
- Tag-specific attributes (`href`, `target`, `controls`, `placeholder`,
  and so on) round-trip exactly as written.

### CSS structure

Scamp emits only the properties that differ from the defaults. An
element with a white background and no border produces minimal CSS:

```css
.rect_a1b2 {
  width: 200px;
  height: 100px;
}
```

Unknown CSS properties, whether added through the CSS editor or outside
Scamp, are preserved as custom properties and round-trip through saves.

### Responsive overrides

Styles you set while a non-desktop [breakpoint](breakpoints.md) is
active land inside `@media (max-width: Npx)` blocks at the bottom of the
CSS module, widest first:

```css
.rect_a1b2 {
  width: 100%;
  padding: 24px;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    padding: 12px;
  }
}

@media (max-width: 390px) {
  .rect_a1b2 {
    padding: 8px;
  }
}
```

Unknown `@media` queries, such as `min-width` and `prefers-color-scheme`,
are preserved exactly as written after the known breakpoint blocks.

## Live code preview

The bottom panel shows a read-only preview of the generated TSX and CSS
for the current page. It updates as you make changes on the canvas.

Selecting an element highlights it in both panes and scrolls it into
view: its JSX tag on the left, and every CSS rule that styles it on the
right, including state variants like `:hover` and any `@media`
overrides. Selecting a [component instance](components.md) highlights
only the TSX, because instances have no CSS class of their own.

## Save status

An indicator in the toolbar tracks whether the canvas is in sync with
disk:

| State | Meaning |
|---|---|
| **✓ Saved** | The canvas matches what's on disk. |
| **↑ Saving…** | A debounced write is in progress. |
| **● Unsaved** | You made edits, and the debounce hasn't fired yet. |
| **⚠ Save failed** | The last write failed. Click **Retry** to try again. |

Most of the time you see only **Saved**: writes happen in about 200 ms
and succeed silently.

## Sync behavior

- **Debounced writes**: Scamp waits briefly after your last change before
  writing to disk, which avoids excessive file I/O.
- **Atomic file writes**: Scamp writes files atomically, so external
  tools never read a partial file.
- **Background format migrations**: When Scamp opens an older project
  that uses the pre-canvas-rework root sizing, it silently rewrites
  `.root` to the new format on first open. A one-time banner tells you.

For external editing, see [Bidirectional sync](bidirectional-sync.md).
