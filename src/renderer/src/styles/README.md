# App-chrome styles

Two files live here:

- **`theme.css`** — `:root` CSS custom properties that drive the Scamp UI
  itself (toolbars, panels, inputs, dialogs). Imported once from
  `main.tsx` before any module CSS so every component can reference
  the tokens.
- **`global.css`** — font-face declarations, body resets, scrollbar
  styling. Uses `var(--…)` from `theme.css`.

## Using the tokens

Module CSS files under `src/renderer/src/` should reference tokens
rather than hard-coded hex values:

```css
/* ✅ */
.panel {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

/* ❌ */
.panel {
  background: #1f1f1f;
  border: 1px solid #2c2c2c;
  color: #e0e0e0;
}
```

Naming is semantic two-part (not numeric scales). Pick the closest
semantic match:

- **Backgrounds** — `--bg-canvas`, `--bg-surface`, `--bg-input`,
  `--bg-raised`, `--bg-header`, `--bg-hover`
- **Borders** — `--border`, `--border-subtle`, `--border-strong`
- **Text** — `--text-primary`, `--text-secondary`, `--text-tertiary`,
  `--text-inverse`
- **Accent** — `--accent`, `--accent-hover`, `--accent-muted`,
  `--accent-dark`
- **Status** — `--status-error`, `--status-warn`, `--status-success`
- **Banner pairs** — `--info-bg` / `--info-text` / `--info-border`,
  `--warn-bg` / `--warn-text`, `--error-bg` / `--error-text`
- **Overlay** — `--backdrop`, `--shadow-popover`, `--shadow-tooltip`
- **Geometry** — `--radius-sm`, `--radius-md`, `--radius-lg`,
  `--control-h`, `--row-h`
- **Typography** — `--font-ui`, `--font-sans`

If an existing token doesn't fit, add a new one to `theme.css` rather
than reintroducing a raw hex. One-off colors that genuinely don't
repeat (e.g. a specific brand illustration) can stay literal — flag
in a comment.

## Not to be confused with

Every Scamp project has its own `theme.css` inside the project folder
that stores the *user's* design tokens (the tokens managed by the
Theme panel and referenced from the user's exported CSS). That file
is a separate concern — don't conflate it with this app-chrome theme.
