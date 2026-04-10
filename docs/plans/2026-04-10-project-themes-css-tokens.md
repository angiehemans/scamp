# Project Themes & CSS Variable Tokens — Plan

**Status:** Draft, awaiting user review. Do not implement until approved.
**Date:** 2026-04-10

## Goal

Let users define named color tokens as CSS custom properties in a per-project
`theme.css` file. Tokens are usable from both the WYSIWYG panel (via a token
picker in the color input) and the raw CSS editor (via autocompletion).
Changes to `theme.css` — whether made by the user, an agent, or by hand —
are hot-reloaded into the app.

Scope: **color tokens only** for this story. Spacing and typography tokens
are deferred.

---

## The theme file

Every project gets a `theme.css` in its root:

```css
:root {
  --color-primary: #3b82f6;
  --color-secondary: #6366f1;
  --color-background: #ffffff;
  --color-surface: #f5f5f5;
  --color-text: #111111;
  --color-muted: #888888;
}
```

- Plain CSS — works outside Scamp if the user takes their files elsewhere.
- Generated on project creation with a sensible starter palette.
- Watched by chokidar and hot-reloaded on every save.
- Documented in `agent.md` so AI agents know how to use it.

---

## Data flow

```
theme.css on disk
    │
    ├── [project open] ──────────────────┐
    │                                    ▼
    ├── [chokidar change] ──► main process IPC ──► renderer
    │                                    │
    │                         parseThemeCss()
    │                                    │
    │                              ┌─────▼─────┐
    │                              │ Zustand    │
    │                              │ themeTokens│
    │                              └─────┬─────┘
    │                                    │
    │             ┌──────────────────────┼──────────────────┐
    │             ▼                      ▼                  ▼
    │     ColorInput              CSS autocomplete    ElementRenderer
    │     token picker            var(--name)         resolve var() for
    │     in sections             suggestions         canvas preview
    │
    └── [Theme panel write] ──► main process ──► theme.css on disk
```

---

## Implementation phases

### Phase 1 — Theme file infrastructure

1. **Default theme content.** Add `DEFAULT_THEME_CSS` constant to
   `src/shared/agentMd.ts` with the starter palette above.

2. **Generate on project create.** In `src/main/ipc/project.ts`, write
   `theme.css` alongside the page files when creating a new project.

3. **Theme parser.** New pure function `parseThemeCss(css: string)` in
   `src/renderer/lib/parseTheme.ts`. Parses a CSS file and extracts all
   `--*` custom properties from `:root` rules. Returns:
   ```ts
   type ThemeToken = {
     name: string;    // e.g. "--color-primary"
     value: string;   // e.g. "#3b82f6"
   };
   ```
   Uses postcss (already a dependency) to parse. Ignores non-`:root`
   rules and non-color tokens for now (any `--*` is extracted — the UI
   filters to colors later).

4. **Store the tokens.** Add `themeTokens: ThemeToken[]` and a
   `setThemeTokens` action to `canvasSlice.ts`. Not persisted — derived
   from the file on every load/change.

5. **Load on project open.** In `ProjectShell.tsx`, read `theme.css`
   from the project folder on mount via a new IPC channel
   `theme:read` → returns the file content as a string (or empty string
   if the file doesn't exist). Parse it and call `setThemeTokens`.

6. **Watch for changes.** Extend the chokidar watcher in
   `src/main/watcher.ts` to detect changes to `theme.css`. Emit a new
   IPC event `theme:changed` with the file content. The renderer
   listens in the sync bridge and calls `setThemeTokens` with the
   freshly parsed tokens.

7. **IPC channels.** Add to `ipcChannels.ts`:
   - `ThemeRead: 'theme:read'`
   - `ThemeChanged: 'theme:changed'`
   - `ThemeWrite: 'theme:write'`

8. **Update agent.md.** Add a "CSS Variables and Tokens" section
   documenting `theme.css` usage, the `:root` convention, and how to
   reference tokens with `var(--name)`.

9. **Unit tests.** Test `parseThemeCss` with:
   - A well-formed theme file → correct token list
   - Empty file → empty array
   - File with non-`:root` rules → those are ignored
   - Duplicate property names → last wins
   - Malformed CSS → returns empty array, doesn't throw

**Acceptance:** new projects get a `theme.css`, opening a project loads
tokens into the store, editing `theme.css` externally updates the store.

---

### Phase 2 — Token picker in ColorInput

1. **Token swatch row.** Add a new section above the preset swatches in
   the SketchPicker popover: a labeled row of token swatches. Each
   swatch shows the resolved color and the token name on hover (via
   `title`). Clicking a token swatch calls `onChange` with
   `var(--color-primary)`.

2. **Pass tokens to ColorInput.** Add an optional `tokens` prop to
   `ColorInput`:
   ```ts
   type Props = {
     value: string;
     onChange: (value: string) => void;
     presetColors?: ReadonlyArray<string>;
     tokens?: ReadonlyArray<ThemeToken>;
   };
   ```

3. **Wire tokens from the store.** In `BackgroundSection`,
   `BorderSection`, and `TypographySection`, read `themeTokens` from the
   store and pass color-only tokens to `ColorInput`.

4. **Resolve `var()` for display.** When ColorInput's `value` is
   `var(--color-primary)`, the swatch needs to show the resolved color.
   Add a small resolver: look up the token name in the `tokens` array
   and use its `value` for the swatch background and the picker's
   `color` prop. The text input still shows `var(--color-primary)`.

5. **Token indicator.** When the current value is a `var()` reference,
   show a small label below the swatch (e.g. `--color-primary`) so the
   user knows a token is applied, not a raw color.

**Acceptance:** user can click a token swatch to apply `var(--name)`,
the swatch shows the resolved color, and the value round-trips through
generateCode/parseCode (it goes into `customProperties` or the typed
field as a string — no special handling needed since the generator emits
it verbatim).

---

### Phase 3 — CSS editor autocompletion

1. **Token completion source.** In `cssCompletion.ts`, add a completion
   provider that activates when the cursor is in a value position and
   offers `var(--token-name)` suggestions for all loaded tokens.

2. **Read tokens in the completion.** The completion function needs
   access to the store. Since `cssCompletion.ts` is a pure module, pass
   the tokens via a factory function:
   ```ts
   export const createCssCompletion = (
     getTokens: () => ThemeToken[]
   ) => { ... };
   ```
   The `CssPanel` and `PropertiesPanel` (which configure CodeMirror
   extensions) call this factory with a getter that reads from the
   store.

3. **Completion display.** Each suggestion shows the token name and
   its resolved value as a detail label (e.g.
   `var(--color-primary)  #3b82f6`).

**Acceptance:** typing `var(` in the CSS editor shows token suggestions.
Selecting one inserts the full `var(--name)` string.

---

### Phase 4 — Theme management panel

1. **ThemePanel component.** A modal dialog (like CreateProjectModal)
   accessible from a "Theme" button in the project toolbar. Shows all
   current tokens in an editable list:
   - Each row: token name input (`--color-*`), color picker for the
     value, delete button.
   - "Add token" button at the bottom.
   - Validation: names must start with `--`, no spaces, no duplicates.

2. **Write on change.** When the user edits a token name, value, or
   deletes one, regenerate the `theme.css` content and write it via
   `theme:write` IPC. The chokidar round-trip reloads the tokens into
   the store, keeping everything in sync.

3. **Delete warning.** When deleting a token, scan all elements in the
   current page for `var(--name)` references. If any are found, show a
   confirmation: "This token is used by N elements. Delete anyway?"
   Deleting does NOT automatically replace the references — they become
   unresolved `var()` calls (the CSS still works, just falls back).

4. **Toolbar button.** Add a "Theme" button in the Toolbar next to
   "Settings". Only shown when a project is open.

**Acceptance:** user can add, rename, recolor, and delete tokens from
the UI. Changes persist to `theme.css` and are reflected immediately in
the color pickers and CSS editor.

---

## Canvas rendering of `var()` values

When an element has `backgroundColor: 'var(--color-primary)'`, the
canvas needs to show the resolved color, not a literal string.

In `ElementRenderer.tsx`'s `elementToStyle`, color fields that start
with `var(` are resolved against the `themeTokens` array in the store.
The lookup is simple: extract the token name from `var(--name)` and
find the matching token's value. If not found, fall back to
`transparent` (same as an unresolved CSS variable).

This resolution is canvas-only — the generated CSS file keeps the
`var()` reference so it works in production with the real theme.css
import.

---

## Files changed

| File | Change |
|---|---|
| `src/shared/ipcChannels.ts` | Add `ThemeRead`, `ThemeChanged`, `ThemeWrite` |
| `src/shared/types.ts` | Add `ThemeToken` type |
| `src/shared/agentMd.ts` | Add `DEFAULT_THEME_CSS`, update agent.md content |
| `src/main/ipc/project.ts` | Write `theme.css` on project create |
| `src/main/ipc/theme.ts` | New — read/write theme.css handlers |
| `src/main/watcher.ts` | Detect `theme.css` changes, emit `theme:changed` |
| `src/main/index.ts` | Register theme IPC |
| `src/preload/index.ts` | Expose theme read/write/changed APIs |
| `src/renderer/lib/parseTheme.ts` | New — `parseThemeCss()` pure function |
| `src/renderer/store/canvasSlice.ts` | Add `themeTokens`, `setThemeTokens` |
| `src/renderer/src/syncBridge.ts` | Listen for `theme:changed` |
| `src/renderer/src/components/ProjectShell.tsx` | Load theme on mount |
| `src/renderer/src/components/controls/ColorInput.tsx` | Token swatch row, var() resolution |
| `src/renderer/src/components/sections/*.tsx` | Pass tokens to ColorInput |
| `src/renderer/lib/cssCompletion.ts` | Token autocompletion |
| `src/renderer/src/components/ThemePanel.tsx` | New — token management modal |
| `src/renderer/src/components/ThemePanel.module.css` | New — styles |
| `src/renderer/src/components/Toolbar.tsx` | Add "Theme" button |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Resolve `var()` for canvas |
| `test/parseTheme.test.ts` | New — unit tests for theme parser |

---

## Out of scope

- Spacing / typography / shadow tokens (future stories)
- Importing themes from external sources
- Theme presets or starter libraries
- Auto-generating token names from used colors
- Per-page theme overrides
- Token scoping (everything is `:root` global)
- Importing `theme.css` in the generated TSX (the user or their
  bundler handles that — Scamp just writes the file)

---

## Risks

- **`var()` in typed fields.** The element model stores colors as
  strings. `var(--color-primary)` is a valid string, so it flows
  through `generateCode`/`parseCode` unchanged — no model changes
  needed. The only challenge is canvas rendering, which is handled by
  the resolver in ElementRenderer.

- **Token name collisions.** The theme panel validates names on input.
  If an agent writes a duplicate token in `theme.css`, the parser takes
  the last one (same as CSS cascade). No crash, just potentially
  surprising behavior — acceptable for now.

- **Large theme files.** The parser reads the entire file on every
  change. For the expected size (tens of tokens, not thousands), this
  is fast enough. No pagination or lazy loading needed.
