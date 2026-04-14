# Code Output

Scamp generates real, production-ready code files as you design.

## What Gets Generated

Each page produces two files:

- **`pagename.tsx`** -- A React component with JSX markup.
- **`pagename.module.css`** -- A CSS Module with scoped class names.

### TSX Structure

```tsx
<div className={styles.rect_a1b2} data-scamp-id="a1b2">
  <div className={styles.rect_c3d4} data-scamp-id="c3d4" />
</div>
```

- Each element gets a `data-scamp-id` attribute for Scamp to track it.
- Class names follow the pattern `elementname_shortid`.

### CSS Structure

Only properties that differ from defaults are emitted. An element with a white background and no border produces minimal CSS:

```css
.rect_a1b2 {
  width: 200px;
  height: 100px;
}
```

Unknown CSS properties (added via the CSS editor or externally) are preserved in a `customProperties` block and round-trip through saves.

## Live Code Preview

The bottom panel shows a read-only live preview of the generated TSX and CSS for the current page. It updates as you make changes on the canvas.

## Sync Behavior

- **Debounced writes** -- Scamp waits briefly after your last change before writing to disk, avoiding excessive file I/O.
- **Atomic file writes** -- Files are written atomically to prevent partial reads by external tools.

For details on external editing, see [Bidirectional Sync](bidirectional-sync.md).
