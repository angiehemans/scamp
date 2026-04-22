# Code Output

Scamp generates real, production-ready code files as you design.

## What Gets Generated

Each page produces two files:

- **`pagename.tsx`** — A React component with JSX markup.
- **`pagename.module.css`** — A CSS Module with scoped class names.

### TSX Structure

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

- Each element gets a `data-scamp-id` attribute matching its CSS class name.
- Class names follow the pattern `prefix_shortid` (`rect_`, `text_`, `img_`, or `input_`).
- The HTML tag is whatever you chose in the Element section — Scamp emits it directly. See [Elements](elements.md).
- Tag-specific attributes (`href`, `target`, `controls`, `placeholder`, etc.) round-trip verbatim.

### CSS Structure

Only properties that differ from defaults are emitted. An element with a white background and no border produces minimal CSS:

```css
.rect_a1b2 {
  width: 200px;
  height: 100px;
}
```

Unknown CSS properties (added via the CSS editor or externally) are preserved in a `customProperties` block and round-trip through saves.

### Responsive Overrides

Styles you set while a non-desktop [breakpoint](breakpoints.md) is active land inside `@media (max-width: Npx)` blocks at the BOTTOM of the CSS module, widest first:

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

Unknown `@media` queries (e.g. `min-width`, `prefers-color-scheme`) are preserved verbatim after the known breakpoint blocks.

## Live Code Preview

The bottom panel shows a read-only live preview of the generated TSX and CSS for the current page. It updates as you make changes on the canvas.

## Save Status

A small indicator in the toolbar tracks whether the canvas is in sync with disk:

| State | Meaning |
|---|---|
| **✓ Saved** | Canvas state matches what's on disk |
| **↑ Saving…** | Debounced write in progress |
| **● Unsaved** | Edits made, waiting for the debounce to fire |
| **⚠ Save failed** | The last write failed — click **Retry** to try again |

Most of the time you'll only see Saved — writes happen in ~200ms and succeed silently.

## Sync Behavior

- **Debounced writes** — Scamp waits briefly after your last change before writing to disk, avoiding excessive file I/O.
- **Atomic file writes** — Files are written atomically to prevent partial reads by external tools.
- **Background format migrations** — When Scamp opens an older project that uses the pre-canvas-rework root sizing, it silently rewrites `.root` to the new format on first open. A one-time banner lets you know.

For details on external editing, see [Bidirectional Sync](bidirectional-sync.md).
