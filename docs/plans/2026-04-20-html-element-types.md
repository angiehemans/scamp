# HTML Element Types — Plan

**Status:** Draft for review.
**Date:** 2026-04-20
**Story:** `docs/backlog-2.md` §4.

## Goal

Let users assign a semantic HTML tag to any element (with round-tripped
tag-specific attributes), add a new **input** element type for forms,
and render everything correctly on the canvas without leaking
browser-default chrome.

---

## What already works

- `ScampElement.tag?: string` is already on the element type
  (`src/renderer/lib/element.ts:40`).
- `generateCode` and `parseCode` already round-trip a non-default tag
  for existing types — `test/integration/sync.integration.test.ts:133`
  proves `h1` and `section` work end-to-end.
- `ElementRenderer` already renders a dynamic tag via
  `createElement(tag, props, children)`
  (`src/renderer/src/canvas/ElementRenderer.tsx:354`).
- Class-prefix generation is a function of `el.type`, not `el.tag`
  (`src/renderer/lib/generateCode.ts:48`) — a `nav` rectangle still
  gets `rect_`, matching the story's requirement.
- A starter `TagSection.tsx` exists but only renders for
  `type === 'text'` and lists 12 text tags
  (`src/renderer/src/components/sections/TagSection.tsx`).

## What's missing

- **Per-tag attribute storage, emission, and parsing.** Only
  `src`/`alt` are typed today; no generic attribute round-trip.
- **Broader `TEXT_TAGS` set** in `parseCode.ts:50` — missing `pre`,
  `time`, `figcaption`, `legend`, `li`.
- **A fourth element `type` — `'input'`** — plus its factory,
  toolbar button, store action, and canvas-render defaults.
- **`select`/`option` data model** — options must live as a list on
  the select element, not as independent canvas children.
- **Context-aware defaults** — `<ul>`/`<ol>` child defaults to `<li>`.
- **Collapsible `Section`** — `sections/Section.tsx` has no collapse
  state; the story wants the new Element section collapsible.
- **Browser-chrome reset** on canvas for `button`/`a`/`select`/
  `input[type=range]` etc.
- **`agent.md` updates** — the constant is written once at project
  creation (`src/main/ipc/project.ts:101`), so existing projects
  won't see the new docs.

---

## Key design decisions (flag for review)

### 1. Attribute storage — **hybrid**

Keep what's already typed (`src`, `alt`, `text`, opacity, etc.) and
add two fields:

```ts
type ScampElement = {
  // ...existing...
  /** Generic HTML attribute bag, mirrors how `customProperties` works
   *  for CSS. Tag-specific panel fields write here; parser collects
   *  every attribute that isn't already typed. */
  attributes?: Record<string, string>;
  /** Structured children that aren't canvas elements — currently just
   *  `<select>` options. Each entry emits one `<option>` in the
   *  generated TSX. */
  selectOptions?: ReadonlyArray<SelectOption>;
  /** Raw SVG inner source, passed verbatim to TSX when tag === 'svg'. */
  svgSource?: string;
};

type SelectOption = {
  value: string;
  label: string;
  selected?: boolean;
};
```

**Boolean-attribute convention.** Emit bare (`controls`,
`autoplay`, `muted`, `open`, `selected`) when the value is the empty
string `""`. Emit quoted (`rows="3"`) otherwise. Parser stores
boolean-present attributes as `""`.

**Why hybrid, not pure bag.** A pure `attributes` bag means the panel
can't type-check `target="_blank"` or `method="GET"` at the store
boundary; a pure typed-field approach bloats `ScampElement` with a
dozen mostly-undefined fields. The hybrid preserves the "unknown
attributes verbatim, never discarded" story requirement while keeping
the two structurally-different cases (options list, SVG source) typed.

### 2. `select`/`option` — JSON list, not canvas children

- `selectOptions` lives on the select element as a typed field
  (above).
- The generator emits options as inline JSX children of `<select>`.
- The parser treats `<option>` specially: when it encounters `<select>`
  it consumes `<option>` children into `selectOptions` and does **not**
  descend into them as normal tree elements.
- `option` is never a drawable element type — it has no class name, no
  `data-scamp-id`, no position in the element map.

This is a single well-contained special case in the parser. The
alternative (hidden children flagged `hiddenFromCanvas`) would force
every tree-aware subsystem (selection, drag, resize, layers panel) to
opt out — not worth it.

### 3. New element type: `'input'`, class prefix `input_`

- `ScampElement.type` becomes `'rectangle' | 'text' | 'image' | 'input'`.
- Class prefix `input_` — consistent with `rect_`/`text_`/`img_`.
- Covers the tags `input`, `textarea`, `select`. `option` is handled
  via `selectOptions` (above).
- Default tag: `input`. Default attribute: `{ type: 'text' }`.
- `parseCode.inferElementType` gets a fourth branch recognising the
  `input_` prefix.

### 4. Element section replaces `TagSection`

- Rename/expand `sections/TagSection.tsx` → `sections/ElementSection.tsx`.
- Always rendered as the first section in `UiPanel` for every element
  type (including image and input).
- Adds `collapsible` + `defaultOpen` props to the shared
  `sections/Section.tsx`, with local `useState` for the open flag.
- Tag dropdown options come from a typed table (`elementTags.ts` in
  `renderer/lib/`) keyed by element type.
- Tag-specific attribute controls are rendered conditionally based on
  the current tag (e.g. `a` shows `href` + `target`, `video` shows
  `src`/`controls`/`autoplay`/`loop`/`muted`). All controls write
  through `patchElement` into either `attributes`, `selectOptions`, or
  `svgSource`.

### 5. SVG raw-source handling — in scope but narrow

- `svg` renders on the canvas as a placeholder rectangle (not real
  SVG). Only the TSX output contains the raw source.
- Parser: when it encounters `<svg>`, capture the substring between
  the opening and closing tag verbatim via index arithmetic on the
  source string (htmlparser2 won't give this directly — fall back to
  a small regex + balanced-tag lookahead, or just a literal
  `<svg …>…</svg>` scan before feeding the rest to htmlparser2).
- An editable textarea in the Element section commits the new source
  on blur.

### 6. Browser-default chrome reset

Add a conservative reset in `ElementRenderer.module.css`:

```css
.element button,
.element a,
.element select,
.element input,
.element textarea {
  all: revert-layer;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  appearance: none;
}
```

Also prevent default behaviour at the interaction layer for `<a>`
clicks and `<button>` submits while the canvas is in edit mode
(`event.preventDefault()` inside the existing pointer handlers).

### 7. `<dialog>` rendering

- On the canvas, render `<dialog>` as a plain `<div data-tag="dialog">`
  so `open` doesn't trigger modal behaviour. The `tag` field on the
  element still says `dialog` — that's what the generator uses to emit
  the real `<dialog open>` to disk.
- `ElementRenderer` gets a small `canvasRenderTag(el)` helper that
  overrides a handful of "problematic on canvas" tags. Kept small and
  explicit (dialog is the main case; svg follows the same pattern).

---

## Phased rollout

### Phase 1 — Groundwork (parser + generator + data model)

Goal: round-trip every semantic tag + tag-specific attribute through
disk, without touching UI.

1. **Extend `ScampElement`** with `attributes`, `selectOptions`,
   `svgSource`.
2. **Broaden `TEXT_TAGS`** in `parseCode.ts:50` to include `pre`,
   `time`, `figcaption`, `legend`, `li`.
3. **Add `'input'` type** to the `ScampElement.type` union; ripple
   through:
   - `classNameFor` → add `input_` prefix
     (`generateCode.ts:48`).
   - `inferElementType` → recognise `input_` prefix
     (`parseCode.ts:76`).
   - `defaultTagFor` / `defaultTagForType` → return `input`.
4. **Generator attribute emission** in `renderJsx`
   (`generateCode.ts:72`): after the standard attrs, walk
   `el.attributes` entries and emit each (applying the boolean-attribute
   convention).
5. **Generator special cases:**
   - `<select>` → inline `<option>` children from `el.selectOptions`.
   - `<svg>` → emit `el.svgSource ?? ''` verbatim as the tag's inner
     text content (generator already supports element text for text
     elements; extend to rectangle/input elements when tag === 'svg'
     or guard with a dedicated branch).
6. **Parser attribute collection**
   (`parseCode.ts:95`): read every attribute that isn't
   `data-scamp-id`/`classname`/`src`/`alt` into `el.attributes`. Omit
   the field entirely when empty (round-trip stability).
7. **Parser `<select>` special case**: stop descent, collect
   `<option>` children into `selectOptions`.
8. **Parser `<svg>` special case**: capture the inner source verbatim
   into `svgSource`.

**Tests (all unit / integration, no renderer):**
- `test/parseCode.test.ts` — attribute round-trip (`href`+`target`,
  `method`+`action`, `datetime`, boolean attrs); every new text tag;
  `input`/`textarea`/`select` element type inference.
- `test/generateCode.test.ts` — attribute emission, boolean
  convention, `<select>`+options, `<svg>` source.
- `test/integration/sync.integration.test.ts` — add cases for each
  element family. The existing harness handles this pattern.

### Phase 2 — Canvas rendering

1. **Collapsible `Section`** — add `collapsible?: boolean;
   defaultOpen?: boolean` props; local state.
2. **`ElementSection.tsx`** replacing `TagSection.tsx`:
   - Always rendered, all element types.
   - Tag dropdown driven by a typed options table.
   - Conditional attribute inputs per tag.
3. **Browser-chrome reset** in `ElementRenderer.module.css`.
4. **`canvasRenderTag(el)` helper** for dialog/svg divergence.
5. **Default prevention** on `<a>` clicks / `<button>` submits inside
   the canvas interaction layer.

### Phase 3 — Input element type + context defaults

1. **Toolbar `input` tool** (shortcut `F`) — extend `Tool` union,
   `TOOLS` table in `Toolbar.tsx`, keyboard handler.
2. **`createInput` store action** — mirrors `createRectangle`; default
   tag `input`, default `attributes: { type: 'text' }`.
3. **`CanvasInteractionLayer.handlePointerDown` input branch** —
   mirrors the rectangle drag-create flow.
4. **Context-aware defaults** in `createRectangle` + `createText`
   (store actions): if `parent.tag === 'ul' || parent.tag === 'ol'`,
   set the new element's `tag` to `li`.
5. **Canvas hints for input types** — e.g. checkbox renders as a small
   square, range as a thin bar. Small CSS-only treatment; no heavy
   per-type rendering logic.

### Phase 4 — Docs + polish

1. **`agent.md`** in `src/shared/agentMd.ts` — expand tag coverage.
   Flag existing-project migration: we either (a) write a follow-up
   that detects out-of-date `agent.md` on project open and prompts to
   update, or (b) accept that existing projects need a manual
   refresh. Recommend **(b)** for this phase, ticket (a) separately.
2. **Tooltips** on tag-specific attributes (e.g. `target="_blank"`
   explanation).
3. **Out-of-scope explicitly:** focus rings, validation, form
   submission behaviour, accessibility auditing. This story is about
   producing the right output, not building a form runtime.

---

## File-by-file changes

| File | Phase | What changes |
|---|---|---|
| `src/renderer/lib/element.ts` | 1 | Add `'input'` to type union; add `attributes`, `selectOptions`, `svgSource`, `SelectOption` type |
| `src/renderer/lib/defaults.ts` | 1 | (Possibly) `DEFAULT_INPUT_STYLES` if input needs distinct defaults from rectangle |
| `src/renderer/lib/generateCode.ts` | 1 | Attribute emission; `input_` prefix; `<select>`/`<svg>` special cases |
| `src/renderer/lib/parseCode.ts` | 1 | Expanded `TEXT_TAGS`; `input_` prefix; generic attribute collection; `<select>`/`<svg>` special cases |
| `src/renderer/lib/elementTags.ts` (new) | 2 | Typed table: tag options per element type + tag-specific attribute spec |
| `src/renderer/src/canvas/ElementRenderer.tsx` | 2 | `canvasRenderTag` override; apply `el.attributes` to rendered props |
| `src/renderer/src/canvas/ElementRenderer.module.css` | 2 | Browser-chrome reset |
| `src/renderer/src/canvas/CanvasInteractionLayer.tsx` | 2, 3 | Default-prevent for `<a>`/`<button>`; input tool branch |
| `src/renderer/src/components/sections/Section.tsx` | 2 | Collapsible support |
| `src/renderer/src/components/sections/ElementSection.tsx` (rename) | 2 | Replaces `TagSection.tsx`; all element types; tag-specific controls |
| `src/renderer/src/components/UiPanel.tsx` | 2 | Mount `ElementSection` at the top for every element type |
| `src/renderer/src/components/Toolbar.tsx` | 3 | Input tool button + `F` shortcut |
| `src/renderer/store/canvasSlice.ts` | 1, 3 | `'input'` in `Tool`; `NewInputInput` shape; `createInput`; ul/ol→li default in rect+text actions |
| `src/shared/agentMd.ts` | 4 | Full tag list + attribute docs |
| `test/parseCode.test.ts` | 1 | Every new tag + attribute round-trip |
| `test/generateCode.test.ts` | 1 | Emission, boolean convention, `<select>`/`<svg>` |
| `test/integration/sync.integration.test.ts` | 1 | Round-trip per element family |

---

## Risks / gotchas

- **`type` field collision.** ScampElement already uses `type` as the
  discriminator. HTML `<input type="text">` must go through
  `attributes.type`, not a top-level field. Decision above: input's
  default attributes are `{ type: 'text' }`.
- **SVG parsing.** `htmlparser2` doesn't preserve the inner source
  verbatim. We scan for `<svg …>…</svg>` in the TSX string directly
  before handing the remainder to the parser. Thin layer, small
  surface, but worth a dedicated test.
- **`<a href>` click navigation.** Prevent default at the interaction
  layer; otherwise clicking a link element on the canvas reloads or
  opens a new tab.
- **`<dialog open>` in the DOM.** If rendered as a real dialog on
  canvas it traps focus and positions itself on top of everything.
  Canvas-render override as a `<div>` handles this.
- **Existing projects + `agent.md`.** The file is written once at
  project creation. Expanding the constant only affects new projects.
  Either add a migration prompt (ticket as follow-up) or document that
  users should delete/refresh `agent.md` manually.
- **`inferElementType` miscategorisation risk** during Phase 1
  rollout. The className prefix path is authoritative, so any element
  Scamp produces itself round-trips correctly; only hand-written TSX
  with non-standard prefixes is affected, and the expanded `TEXT_TAGS`
  set covers the story's text list.

---

## Out of scope

- Figma-style "auto-convert rectangles into semantic sections"
  heuristics.
- Form submission runtime on the canvas.
- Accessibility linting (missing `for`/`aria-label`, heading-order
  audits).
- Breakpoint-aware tag changes (story #6 territory).
- External font loading for input placeholders — uses whatever fonts
  the theme already loads.
