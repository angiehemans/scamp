---
title: Components data model
related:
  - src/renderer/lib/element.ts
  - src/renderer/store/canvasSlice.ts
  - src/renderer/src/canvas/ElementRenderer.tsx
  - src/renderer/src/components/DataPanel.tsx
  - src/renderer/lib/extractComponent.ts
  - src/renderer/lib/generateCode.ts
  - src/renderer/lib/parseCode.ts
---

# Components data model

This note covers the four pieces that together make components work:

1. The `component-instance` element type.
2. The `prop` field on text elements (component-side).
3. The `propOverrides` map on instances (page-side).
4. The `componentTrees` cache in the canvas store.

## `component-instance` element type

A component instance on a page is a single canvas element of type `'component-instance'`. It has:

- `componentName: string` — PascalCase folder name. Matches the JSX tag emitted in the page TSX and the folder under `components/`.
- `instanceId: string` — Per-page identifier emitted as `data-scamp-instance-id`. Distinct from the canvas-side `id` so the instance can survive component renames without changing identity. Convention: `inst_<canvas-id-hex>`.
- `propOverrides: Record<string, string>` — Per-instance text overrides keyed by prop name. Empty string is an explicit "render nothing" override, distinct from absent (which falls back to the component-side default).
- `childIds: []` — Always empty. The visible children come from the component definition's tree (looked up via `componentTrees[componentName]`), not the page's element map.

The instance has no class block in the page's CSS module — its visible styling lives entirely in the component file. Only `x` / `y` / position attributes are page-side.

## `prop` on text elements (component-side)

When a text element lives inside a component (active edit target is `activeComponent !== null`), it can carry an optional `prop?: string` — a JS identifier that flips the element from "locked literal" to "parameter".

- `prop` absent → element renders its `text` field verbatim. Locked.
- `prop` set → generator emits `{propName}` in JSX, declares `propName?: string` on the exported `[Name]Props` type, and puts the current `text` value as the default in the function destructure.

`prop` has no meaning on page text elements — the Data tab hides the toggle there.

### Generator behavior

`generateCode({ ..., isComponent: true })` flips three things on top of the page generator:

1. Emits a `type [Name]Props = { propA?: string; … };` declaration before the function.
2. Destructures with defaults on the signature: `function Foo({ propA = "default", … }: FooProps)`.
3. Emits `{propA}` in the JSX where the prop-text element sits, instead of the literal `text`.

Default-text strings are TypeScript-escaped via `tsStringLiteral` (backslash + double-quote + newline + CR).

### Parser round-trip

`parseCode` extracts the destructure into a `propName → defaultText` map (`parsePropsDestructure`), then post-processes every text element whose body matches `/^\s*\{name\}\s*$/`. If the captured name appears in the defaults map, the parser writes `prop = name, text = defaults[name]` onto the element.

Unresolved JSX expressions (e.g. `{whatever}` where `whatever` isn't in the destructure) stay as literal text so user-written / agent-written JSX round-trips byte-stably.

## `propOverrides` (page-side instance)

Set per-instance when the user edits a prop's value from the page Data tab or inline-on-canvas:

- `setPropOverride(instanceId, propName, value)` — writes the value.
- `clearPropOverride(instanceId, propName)` — removes the key entirely; rendering falls back to the component default.

Page TSX serialises overrides as JSX attributes on the instance tag: `<Foo data-scamp-instance-id="inst_a1b2" label="Click me!" />`. parseCode reads them back into the `propOverrides` map. Empty-string overrides round-trip because the JSX attribute is `label=""`, distinct from absence.

## `componentTrees` cache

The canvas store holds `componentTrees: Record<string, { elements, rootId }>` — every component's parsed element tree, keyed by `componentName`. Built once in `ProjectShell` from `project.components` on every project re-read.

When `ElementRenderer` hits a `component-instance` element, it looks up `componentTrees[el.componentName]` and renders the component's element subtree inline (via `renderComponentSubtree`). Instance wrapper owns the click / double-click / context-menu; inner subtree uses `pointer-events: none` so clicks bubble to the wrapper (except prop-text elements, which re-enable `pointer-events: auto` so they can be clicked / double-clicked for inline editing).

Missing-component placeholder: when `componentTrees[name]` is undefined (deleted, renamed externally), the renderer paints a labelled red box so the broken reference is visible on the canvas.

## Extraction (convert-to-component)

`extractSubtreeAsComponent` builds a new element map from a subtree of the page's elements:

- Subtree root → renamed to `ROOT_ELEMENT_ID`, `parentId: null`, `name: undefined` (component identity is its file name).
- Direct children → `parentId` remapped from the old subtree-root id to `ROOT_ELEMENT_ID`.
- Deeper descendants → kept verbatim.

The old subtree-root id is NOT preserved in the new map; descendants keep their original ids (4-char hex). After extraction, `replaceSubtreeWithInstance` strips the source subtree from the page and splices in a new instance at the same `childIds` position.

## `isScaffoldRoot` empty-placeholder detection

A "brand-new component" (the `defaultComponentTsx` scaffold) parses to a root with no children, no inline fragments, and all `DEFAULT_ROOT_STYLES` values. The renderer paints a "Component (empty — double-click to edit)" pill in that case so the user has something visible to click.

The check is style-aware (not just `childIds.length === 0`) so a converted leaf rectangle — which has no children but DOES carry visible styling (background, width, height) — renders as a real instance, not the placeholder.
