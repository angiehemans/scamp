# Element Naming & Layers Panel — Plan

**Status:** Draft, awaiting user review. Do not implement until approved.
**Date:** 2026-04-12

## Goal

Let users give elements human-readable names (e.g. "Sidebar", "Hero Card")
that replace the generic "Rectangle" / "Text" labels in the layers panel,
get embedded in the generated CSS class name (`sidebar_a1b2` instead of
`rect_a1b2`), and persist through the file round-trip.

---

## Current state

- `classNameFor(el)` returns `rect_<id>` or `text_<id>` — no custom name.
- `labelFor(el)` in ElementTree shows "Rectangle" / "Text · content".
- `ScampElement` has no `name` field.
- `parseCode` infers element type from the class prefix (`rect_` / `text_`).
- `file:write` does atomic writes of both TSX + CSS together.
- The layers panel already has drag-and-drop reordering and click-to-select.

---

## Design

### Data model

Add `name?: string` to `ScampElement`. When undefined, the element uses
the default class prefix (`rect` / `text`). When set, the slugified name
replaces the prefix.

### Class name format

```
[prefix]_[id]
```

- **Unnamed**: `rect_a1b2` / `text_c3d4` (same as today)
- **Named**: `sidebar_a1b2` / `hero-card_c3d4`

The ID suffix is always kept — it guarantees uniqueness. The prefix is
derived by slugifying the name: lowercase, spaces → hyphens, strip
non-alphanumeric-or-hyphen characters.

### `data-scamp-id` = full class name

Today `data-scamp-id` stores just the 4-char hex id (`a1b2`). This plan
changes it to store the **full class name** (`sidebar_a1b2`), matching
the CSS selector exactly. This eliminates any room for mismatches between
the id attribute and the class name.

- `data-scamp-id="sidebar_a1b2"` + `className={styles.sidebar_a1b2}`
- `data-scamp-id="rect_a1b2"` + `className={styles.rect_a1b2}` (unnamed)
- `data-scamp-id="root"` + `className={styles.root}` (root, unchanged)

The internal `ScampElement.id` stays as the short 4-char hex (`a1b2`).
`classNameFor(el)` computes the full class name from the element's type/name
+ id. `data-scamp-id` emits the result of `classNameFor(el)` instead of
`el.id`.

`parseCode` already reads `data-scamp-id` to get the element id — it will
now need to extract the short id from the full class name (everything after
the last `_`). This is a small change to `parseTsxStructure`.

### Slugify rules

```
"Hero Card"     → "hero-card"
"  My Button "  → "my-button"
"Nav/Header"    → "navheader"
"123test"       → "123test"
""              → falls back to "rect" / "text"
```

A `slugifyName(name: string): string` utility handles this. Lives in
`src/renderer/lib/element.ts` next to `generateElementId`.

### Where the name lives in generated files

**In TSX** — `data-scamp-id` carries the full class name, `data-scamp-name`
stores the human-readable display name:

```tsx
<div data-scamp-id="sidebar_a1b2" data-scamp-name="Sidebar" className={styles.sidebar_a1b2} />
```

When no name is set, `data-scamp-name` is omitted and `data-scamp-id`
uses the default prefix:

```tsx
<div data-scamp-id="rect_a1b2" className={styles.rect_a1b2} />
```

**In CSS** — the selector uses the slugified name as the prefix:

```css
.sidebar_a1b2 {
  width: 200px;
  ...
}
```

### Round-trip

- `generateCode` reads `el.name`, slugifies it, and uses it as the class
  prefix. Emits `data-scamp-name="..."` in the JSX.
- `parseCode` reads `data-scamp-name` from each element and stores it as
  `name` on the parsed `ScampElement`. The `className` prefix is NOT used
  to infer the name — the attribute is the source of truth.
- `inferElementType` continues to work: class prefixes that aren't `rect_`
  or `text_` fall through to tag-based inference (existing behavior, no
  change needed).

### Rename operation

The backlog specifies that renaming is a refactor — the class name changes
in both the TSX and CSS files. This is already handled by the existing
flow:

1. User double-clicks the label in the layers panel → enters edit mode.
2. User types a new name, presses Enter or blurs.
3. `patchElement(id, { name: newName })` updates the store.
4. The sync bridge's debounced write regenerates both TSX and CSS via
   `generateCode` with the new class name and writes them atomically
   via `file:write`.
5. chokidar detects the change but the write-suppression set prevents
   a re-parse echo.

**No new IPC channel is needed.** The existing `patchElement` → sync
bridge → `file:write` flow handles the two-file atomic write already.
The class name change is just a consequence of `generateCode` reading
the updated `name` field. This is simpler and safer than a separate
`element:rename` IPC — fewer code paths, same atomicity guarantee.

### Error handling

- `file:write` uses atomic writes (`.tmp` → rename). If the write fails,
  the original files are untouched.
- The store is updated optimistically (name changes immediately in the
  layers panel). If the file write fails, the sync bridge's next
  round-trip will re-parse the unchanged files and revert the store.

---

## Implementation phases

### Phase 1 — Data model + code generation

1. Add `name?: string` to `ScampElement` in `element.ts`.
2. Add `slugifyName(name: string): string` utility in `element.ts`.
3. Update `classNameFor(el)` to use `slugifyName(el.name)` as the prefix
   when `name` is set, falling back to `rect` / `text`.
4. Update `generateCode`'s `renderJsx` to emit `data-scamp-id` as the
   full class name (result of `classNameFor`), and emit `data-scamp-name`
   when the element has a name.
5. Update `parseCode`'s `parseTsxStructure` to:
   - Read `data-scamp-name` from attributes and store on `RawElement`.
   - Extract the short id from `data-scamp-id` (everything after the
     last `_`, or `"root"` for the root element).
6. Update `makeBaseline` in `parseCode` to carry the name through to
   `ScampElement`.
7. Update `cloneElementSubtree` to copy the `name` field (clones should
   NOT keep the same name — append " copy" or clear it).
8. **Tests**:
   - `slugifyName` — all the edge cases above.
   - `classNameFor` — named vs unnamed elements.
   - `generateCode` — named elements emit `data-scamp-name` and use the
     slugified class prefix.
   - `parseCode` — named elements round-trip with name preserved.
   - Round-trip integration test with named elements.

**Acceptance:** named elements generate CSS classes with the custom
prefix, the name round-trips through `generateCode` → `parseCode`, and
existing unnamed elements are unaffected.

### Phase 2 — Layers panel rename UI

1. Add `renamingId` state to `ElementTree`.
2. On double-click of a row label → set `renamingId` to that element's id.
3. Render an `<input>` in place of the label text when `renamingId`
   matches.
4. On Enter or blur → call `patchElement(id, { name: value })`, clear
   `renamingId`.
5. On Escape → cancel, clear `renamingId` without patching.
6. Update `labelFor` to show the custom name when set, falling back to
   the current "Rectangle" / "Text · content" labels.
7. Empty name input → clear the name (`patchElement(id, { name: undefined })`),
   reverting to the default prefix.

**Acceptance:** double-clicking a layer label opens an inline edit input.
Confirming the name updates the layers panel label, the canvas class name,
and the generated CSS file — all in one flow.

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/lib/element.ts` | Add `name?: string` to `ScampElement`, add `slugifyName()` |
| `src/renderer/lib/generateCode.ts` | Update `classNameFor` to use name prefix, emit `data-scamp-name` |
| `src/renderer/lib/parseCode.ts` | Read `data-scamp-name`, carry through to ScampElement |
| `src/renderer/src/components/ElementTree.tsx` | Inline rename on double-click, updated `labelFor` |
| `test/generateCode.test.ts` | Tests for named element class generation |
| `test/parseCode.test.ts` | Tests for named element parsing |
| `test/element.test.ts` or inline | Tests for `slugifyName` |

**No new IPC channels.** No new components. No store changes beyond the
new `name` field on `ScampElement`.

---

## Out of scope

- Renaming the root element (it stays `root` always).
- Bulk rename / find-and-replace across elements.
- Name uniqueness validation (the ID suffix handles uniqueness).
- Name shown on the canvas (only in the layers panel).
- Keyboard shortcut for rename (double-click only for now).

---

## Risks

- **Existing projects with named files.** If someone hand-wrote a CSS
  class like `.navbar_a1b2`, `parseCode` won't know it's a custom name
  unless `data-scamp-name` is present. The class will still parse correctly
  (the prefix is ignored for type inference when it's not `rect_` or
  `text_` — it falls through to tag-based inference). The name just won't
  show in the layers panel until the user sets it via the UI.

- **Class name conflicts with CSS identifiers.** The slugified name must
  be a valid CSS identifier. The slugify function strips invalid characters
  and falls back to the type prefix if the result is empty. CSS identifiers
  can't start with a digit, so `slugifyName("123")` → `_123` (prefix with
  underscore).
