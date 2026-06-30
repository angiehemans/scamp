# Components — Plan

**Status:** Draft for review.
**Date:** 2026-05-17
**Source:** `docs/components-userstory.md`
**Depends on:** Next.js file structure
(`docs/plans/2026-04-30-nextjs-file-structure.md`) must ship before
this — the `components/` folder convention and `@/components/…`
import alias both require the scaffolded Next.js project layout to
be in place. Legacy-format projects are intentionally NOT supported
for components (see Out of scope).
**Related:** Visual history panel (component edits become history
entries on a per-component bucket, same model as per-page buckets),
Per-element states (the canvas/state machine for component editing
mirrors the page editor's), Save-status indicator (component-side
writes route through the same `dispatchPageWrite` flow with a
component-aware path resolver).

---

## Goal

Let users build reusable component definitions and place instances
on any page, with changes to the definition automatically
propagating to every instance via the same chokidar-driven sync
the page editor already uses. Concretely:

1. **Define** — convert any element-subtree into a component, OR
   create a blank component from scratch. Each component is its
   own `components/[Name]/[Name].tsx` + `[Name].module.css` pair
   on disk.
2. **Edit** — open a component editor view that looks and behaves
   exactly like the page editor, plus a "Data" tab for declaring
   which text elements are props vs. locked literals.
3. **Place** — drag a component from the sidebar list onto any
   page canvas to create an instance, identified by
   `data-scamp-instance-id`.
4. **Override** — per-instance Data tab + inline canvas editing
   for text props.
5. **Stay safe** — destructive operations (delete component, lock
   a prop with overrides, rename, etc.) confirm with specific
   impact info before writing.

---

## Current state — what we can build on

- **Page editor architecture is the right template.** The page
  editor already does everything a component editor needs: canvas
  selection, properties panel, CSS panel, per-page history, dirty
  tracking via `syncBridge`. We can reuse the same primitives by
  generalising "the thing being edited" from "a page" to "a page
  OR a component".
- **`ScampElement` is a flexible discriminated union.** Adding a
  new element type (`'component-instance'`) follows the existing
  `'rectangle' | 'text' | 'image' | 'input'` pattern. The
  renderer, parser, and generator each have a single switch site
  per type to extend.
- **`parseCode` already handles unfamiliar JSX gracefully.** It
  recognises a fixed set of HTML tags and routes the rest through
  the "unclassed JSX" verbatim-preservation path. We can add
  capitalised-tag detection as a sibling rule that promotes those
  to component instances instead of leaving them as raw fragments.
- **`generateCode` is structural.** It walks the element tree and
  emits JSX per node. A new element type just means a new emit
  branch — `<ComponentName data-scamp-instance-id="…" prop="…"/>`.
- **The chokidar watcher + `project:pagesChanged` we just shipped**
  give us the bidirectional sync model for free. A `components/`
  folder watch would emit a sibling `project:componentsChanged`
  event that triggers a re-read of every page that imports the
  changed component.
- **`ProjectShell` already routes between "start" and "project"
  views.** Extending it with a "component" view (with a
  breadcrumb back to a page) is one more branch in the same
  routing.
- **`ConfirmDialog` is the existing destructive-confirmation
  surface.** All the smart warnings in the userstory match the
  existing pattern.
- **Per-page history buckets** (`historySlice`) already keyed by
  `page.tsxPath`. The same keying works for components keyed by
  `component.tsxPath`.
- **The `@/` path alias.** This will be added by the Next.js
  file structure story to `tsconfig.json`. We need it pointing
  at the project root so `@/components/Button/Button` resolves.
  Verify the dependency includes this; if not, we add it in
  Phase 1 of this story.

What's NOT there yet:

- No `'component-instance'` element type.
- No `components/` folder support in the project scanner (`readProjectNextjs`).
- No component editor view, breadcrumb, or persistent banner.
- No "Data" tab in the properties panel.
- No prop/locked toggle on text elements.
- No `data-scamp-instance-id` emission or parsing.
- No drag-from-sidebar placement flow.
- No multi-file atomic operations for rename / lock-with-overrides.
- No circular dependency detection.
- No detach affordance.
- No thumbnail capture/storage.

---

## Data model (please review carefully)

This is the highest-stakes area of the plan. The shape we pick
constrains everything downstream — parser, generator, store, IPC.

### New element type: `'component-instance'`

A component instance on a page is a single element. Its model:

```ts
type ComponentInstanceElement = ScampElementBase & {
  type: 'component-instance';
  /** The component's PascalCase name — also its folder name. */
  componentName: string;
  /**
   * Unique within the page. Distinct from `id` so that the
   * instance can keep stable identity across renames and the
   * page TSX can carry a `data-scamp-instance-id` separate
   * from the elements inside the component definition.
   */
  instanceId: string;
  /**
   * Map of propName → override value. Only present when the
   * user has typed something for that prop on this instance;
   * absent keys fall back to the component's default.
   */
  propOverrides: Record<string, string>;
};
```

`childIds` stays empty for component instances — the children
visible on the canvas live inside the component's element tree,
not the page's. The renderer walks the component definition when
rendering the instance.

### Component definition: a sibling-to-pages "thing being edited"

Conceptually a component is a second class of editable artifact
alongside pages. Mirroring the `PageFile` shape:

```ts
type ComponentFile = {
  name: string;             // PascalCase folder name
  tsxPath: string;
  cssPath: string;
  tsxContent: string;
  cssContent: string;
};

type ProjectData = {
  // existing
  pages: PageFile[];
  // new
  components: ComponentFile[];
};
```

`readProjectNextjs` grows a `components/` scan and returns the
list. The watcher's `project:pagesChanged` rename will probably
become `project:contentChanged` (covers both pages and
components) — see open questions.

### Component element tree

When the user enters the component editor, the canvas store is
populated from `parseCode(component.tsxContent,
component.cssContent)` — exactly like a page. The store needs to
know it's editing a component rather than a page so the breadcrumb,
the Data tab, and the save-path resolver behave correctly:

```ts
type ActiveEditTarget =
  | { kind: 'page'; page: PageFile }
  | { kind: 'component'; component: ComponentFile; returnTo?: PageFile };
```

`returnTo` is set when the user entered the component editor from
a page (double-click on instance, or breadcrumb forward); used to
restore the page view on exit.

### Prop / locked state on text elements

A text element inside a component has one of two extra states.
Cleanest model:

```ts
type TextElement = ScampElementBase & {
  type: 'text';
  text: string;
  // existing typography fields …

  // NEW: when present, this text is a prop. When absent, it's
  // a locked literal. Prop name is stored separately so the user
  // can rename the prop without changing the default text.
  prop?: {
    name: string;        // e.g. 'label'
    defaultText: string; // current `text` is the default value
  };
};
```

When `prop` is set, the generator emits `{label}` in JSX and adds
`label?: string` to the component's prop type with the default
value pulled from `prop.defaultText`. When `prop` is absent, the
generator emits the literal `text` value inline.

Stored only on text elements that live inside a component — text
elements on pages have no prop affordance.

### Prop overrides on instances

Already on `ComponentInstanceElement` as `propOverrides:
Record<string, string>`. Per-instance text overrides. Empty
string in the map means "explicitly empty" (distinct from absent,
which means "fall back to default").

---

## Implementation phases

Phases are sized to be merge-friendly individually — each phase
lands a meaningful working slice, even if the full feature isn't
there yet.

### Phase 1 — Foundation: data model + project scan

- Add `'component-instance'` to the `ElementType` union and the
  full element model wiring (TAG_OPTIONS, render branch in
  `ElementRenderer`, inferElementType in `parseCode`, default
  case in `generateCode`).
- Extend `ProjectData` with `components: ComponentFile[]`.
- Add `readProjectNextjs` support: scan `<root>/components/`,
  read each component pair into memory.
- IPC: `component:create`, `component:delete`, `component:read`
  (mirror of the existing `page:*` channels in `pageOps.ts`).
- Add `data-scamp-instance-id` to `parseCode` element recognition
  (alongside `data-scamp-id`) and to `generateCode` emission.

**Ship state after Phase 1:** the data exists in memory and on
disk; nothing renders or is user-visible yet.

### Phase 2 — Component editor view

- Add the `ActiveEditTarget` switch to the canvas store / sync
  bridge so loading + saving routes to the right files.
- Add a "components" section to `ProjectShell`'s left sidebar
  alongside the existing pages list. Empty list at first.
- Wire double-click on a list entry to enter the component
  editor: load the component's elements, swap the breadcrumb,
  show the persistent banner. The actual canvas / panel /
  history are reused unchanged.
- Wire `Esc` / breadcrumb click to exit back to the page (or to
  the project shell if entered from the list directly).
- Page editor and component editor share the same `historySlice`
  but on different buckets keyed by `tsxPath`. No new history
  primitives needed.

**Ship state after Phase 2:** users can scaffold a blank
component via the "+" affordance, enter the editor, draw rects /
text, exit back. Components show up on pages only if the user
edits the page TSX by hand — drag-to-place is the next phase.

### Phase 3 — Placement: drag from sidebar, render instance

- Drag-and-drop from the components list onto the canvas. HTML5
  DnD probably sufficient — `dataTransfer` carries the component
  name. Drop handler creates a `ComponentInstanceElement` at the
  drop coordinates and adds it to the active page's element tree.
- `ElementRenderer` learns a new branch for `component-instance`:
  look up the component's element tree from the store's
  `components` cache, render it as if it were a subtree at this
  position, with the instance's `propOverrides` applied to any
  prop-text descendants.
- `generateCode` emits the import line at the top of the page
  TSX (`import Button from '@/components/Button/Button';`) when
  the page uses an instance.
- Layers panel renders instances with a component icon to
  distinguish them from regular elements; their internal tree is
  shown collapsed-by-default with read-only descendants.

**Ship state after Phase 3:** drag-place works end-to-end. Editing
the component definition re-renders all instances on all pages.
Props aren't editable per-instance yet (next phase).

### Phase 4 — Convert-to-component flow

- Right-click context menu adds "Create component" on any
  element.
- Name input modal — accept input, slugify to PascalCase
  (`hero-card` → `HeroCard`), confirm.
- Atomic IPC: `component:createFromElement` that:
  1. Generates the component's TSX + CSS module from the
     element subtree.
  2. Replaces the element on the page with a new
     `ComponentInstanceElement` pointing at the new component.
  3. Writes the page + the new component files in one logical
     operation. Conflict semantics same as
     `component:rename` below.
- The component editor opens automatically on the new component.

**Ship state after Phase 4:** users can build a page in
free-form and then promote any subtree to a component without
losing layout.

### Phase 5 — Data tab (component side)

- New panel tab structure: `[ UI ] [ CSS ] [ Data ]`. The Data
  tab is only present when the active target is a component;
  pages keep the existing `[ UI ] [ CSS ]` two-tab layout.
- Data tab body: flat list of every text descendant of the
  component root. Each row shows the literal text and a Prop /
  Locked toggle.
- Toggling Locked → Prop: assigns the next default name
  (`prop-1`, `prop-2`, …) and exposes the inline rename input.
- Toggling Prop → Locked: triggers the lock warning if any
  instance has an override (Phase 7 wires the warning; Phase 5
  just makes the toggle work without warnings, and we add the
  warning before the feature ships externally).
- Generator emits `type [Name]Props = { … }` + the destructure
  on the function signature + `{propName}` in the JSX for any
  text element with `prop` set.

**Ship state after Phase 5:** components have props; agent /
hand-written instance overrides work but there's no UI for them
on instances yet.

### Phase 6 — Data tab (instance side) + inline canvas editing

- When a component-instance is selected on a page, the
  properties panel shows the `[ UI ] [ CSS ] [ Data ]` tabs.
  Data shows each declared prop with an editable input.
- Inline canvas editing: double-click a prop-text element inside
  an instance to enter contentEditable mode. The text updates
  the `propOverrides` map on the instance. Locked text shows a
  brief tooltip explaining it can't be edited from here.
- Subtle component-prop styling on the prop-text element on the
  canvas (small icon overlay, or a tinted outline) so users
  can tell at a glance which text is editable per-instance.

**Ship state after Phase 6:** the userstory's central workflow
(define props in the component, override per instance, edit
inline on the page canvas) works end-to-end.

### Phase 7 — Smart warnings + atomic multi-file IPC

- `ConfirmDialog` variants for the five warning shapes in the
  userstory: delete-component, lock-prop-with-overrides,
  rename-component, delete-prop-text, attempt-to-create-cycle.
- Each warning's "impact info" (instance counts per page,
  override values, etc.) is computed by walking the in-memory
  page + component trees — no IPC round-trip needed.
- New atomic IPC channels:
  - `component:rename(oldName, newName)` — renames folder, files,
    function name inside TSX, and every page's import statement.
    Single transaction: stage-and-rename pattern, same as the
    nextjs migration flow. Rollback on any failure.
  - `component:renameProp(componentName, oldProp, newProp)` — updates
    the component type def, the JSX expression, and every page's
    instance JSX attribute. Same atomic pattern.
  - `component:lockProp(componentName, propName)` — removes the
    type def entry, replaces `{prop}` with the literal default
    in the component JSX, and strips the prop attribute from
    every instance on every page.
  - `component:delete(componentName)` — removes the component
    folder AND every instance from every page (with confirmation).
- Circular-dependency detection: when placing component A inside
  component B, walk B's component-instance descendants; if any
  resolves (transitively) to A, refuse.

**Ship state after Phase 7:** the feature is safe to release to
users.

### Phase 8 — Detach

- Right-click on an instance → "Detach from component".
- Confirmation dialog (one-way, no re-attach).
- Inline replacement: clone the component's element tree into
  the page, generate fresh element IDs for every node, apply
  any current `propOverrides` as the literal text on the cloned
  text elements, remove the import statement if no other
  instance of this component is on the page.

**Ship state after Phase 8:** users can break the link when they
need to.

### Phase 9 — Thumbnails

- On every component save, capture a lightweight screenshot of
  the component canvas (the existing PNG export pipeline, scaled
  small).
- Store under `.scamp/component-thumbs/[Name].png` inside the
  project (gitignored by default — add to scaffolded
  `.gitignore`). Refresh on file change.
- Components list renders the thumbnail next to the name. Blank
  / generating components show a placeholder icon.

**Ship state after Phase 9:** components list visually
distinguishes components at a glance.

---

## Open questions (please review)

1. **Single canvas store vs. two stores?** The simplest model is
   one canvas store that swaps its element tree between page and
   component editing. The alternative — two stores, one per
   editor kind — gives stronger isolation but doubles the
   syncBridge surface. **Recommendation: one store, swap target.**
   The history slice already proves this with per-bucket history. agreed.

2. **How does the parser know a JSX tag is a component instance
   vs. a normal HTML tag?** Two signals available: (a) the tag
   starts with a capital letter, and (b) there's a matching
   `import` at the top of the file. Either alone is suspicious;
   together they're unambiguous. **Recommendation: require
   both, and emit a warning into `cssDuplicates`-style soft-error
   bucket if we see one without the other.**
   **Decided:** Recommendation accepted. No additional
   `data-scamp-component-id` attribute — the JSX tag name + the
   `import` statement together are the canonical identifier.
   Adding a third id would create a parallel source of truth
   that has to be kept in sync across rename, lock-prop, delete,
   parse, and generate, with no real upside: hand-renames where
   the tag and import drift apart are already caught by the
   missing-component placeholder path in Q4.

3. **Where do component element trees live in the store?** Two
   options: (a) `elements` map holds page elements only,
   components have their own `componentTrees: Record<name,
   elements>` map that the renderer consults when it hits a
   `component-instance`; (b) one giant `elements` map with
   every element keyed by a globally-unique ID, components'
   roots discoverable via a `componentRoots: Record<name, id>`
   index. **Recommendation: (a)** — clearer ownership, easier
   to invalidate one component's tree without touching others. Agree go with A.

4. **What does the parser do when it sees an instance JSX tag
   for a component that doesn't exist on disk?** A page referencing
   a deleted or renamed component would otherwise crash the
   parse. **Recommendation: parse the instance as a
   placeholder `'component-instance'` element with a
   `missingComponent: true` flag; render it as a labelled error
   box on the canvas; surface a banner pointing at the page so
   the user can fix the reference.**  agreed.

5. **What happens to per-state / per-breakpoint overrides on a
   component-instance element?** Position + sizing make sense
   (move the button on mobile). Per-state overrides on the
   instance itself (hover on the whole instance) also make
   sense. Per-state overrides on the elements INSIDE the
   component… are confusing — those live in the component
   definition. **Recommendation: instances support
   position/size/state overrides at the instance root only; the
   inner tree is read-only at the page level.**
   **Decided:** Recommendation accepted, with the explicit
   clarification that **rendering** is the union of all CSS
   that applies, while **editability** is per-source:
   - Internal component states / transitions / animations
     declared inside the component's CSS module render live on
     every instance on every page — the browser/canvas applies
     them naturally because they're just CSS.
   - Editing those states is only available in the component
     editor (where the state switcher in the panel header
     surfaces them).
   - The instance ROOT (`<Button/>` itself on the page) is a
     separate axis: per-state and per-breakpoint overrides on
     the instance root are editable from the page panel.

6. **Drag-to-place: do we use HTML5 DnD or build our own?**
   HTML5 DnD is built-in but quirky (different image-during-drag
   behaviours per platform, hard to style). Scamp's draw tool
   uses pointer events directly. **Recommendation: HTML5 DnD
   for the sidebar → canvas path** — it gives the user the
   right cursor and the OS-level drag image — even though the
   rest of the canvas uses pointer events. The drop handler
   converts to canvas coordinates. sounds good.

7. **Where do per-component history buckets live?** The
   `historySlice` keys by `activePageId` today. Components
   would key by `tsxPath` same as pages, but the union of
   buckets grows. **Recommendation: keep all buckets in the
   same map; the path key collides only across truly distinct
   files.** sounds good.

8. **What's the "neutral background" for the component editor?**
   The userstory specifies one. Options: a checkerboard, a flat
   surface colour, a tinted version of the canvas background.
   **Decided:** Use whatever the user has set as the page
   background in the project settings, so a component is
   previewed against the same canvas it will appear on. Keeps
   the component's contrast / colour decisions visually
   grounded in the project's actual look.

9. **Where do thumbnails get stored?** Inside the project
   folder under `.scamp/` (visible to git, but typically
   `.gitignore`d), or in the user's Scamp cache directory
   outside the project entirely (no git noise but means
   re-generation on every clone)? **Recommendation:
   `.scamp/component-thumbs/` inside the project, added to
   the scaffolded `.gitignore`.** that sounds good for now, we might want to change this later though.

10. **Component editing while an instance is being rendered.**
    When the user edits a component in the editor, every instance
    re-renders. If the component temporarily has invalid CSS
    (`color: ;` mid-typing), do instances flicker? **Recommendation:
    debounce instance re-renders to the same 200ms boundary as
    file saves so a typing burst doesn't propagate every keystroke.** sounds good.

---

## Out of scope

- **Legacy-format projects.** Components require Next.js layout.
  Legacy projects keep flat `<page>.tsx` files; they cannot
  define components in this story. The components sidebar in
  a legacy project shows an inline "Migrate to Next.js to use
  components" prompt.
- **Variants.** A component with multiple visual configurations
  driven by a discriminator prop is its own feature; called out
  in the userstory and a follow-up.
- **Non-text props.** Boolean, number, enum, and child-content
  (`children`) props are out for v1. Text-only is the minimal
  surface that addresses the core "make this label editable
  per use" case.
- **Component-from-multiple-elements.** Convert-to-component
  works on a single element subtree (the right-clicked element
  + its descendants). Wrapping a multi-select into a new
  component is a follow-up.
- **Slot-style composition.** Passing one component as a child
  of another (`<Card> <Avatar/> </Card>`) is out — instances
  are leaves on the page tree.
- **Component-level breakpoints / states.** Breakpoint and state
  overrides are defined on the page (per instance), not in the
  component definition itself. The component editor's canvas
  shows one fixed breakpoint and the default state.
- **Versioning, design tokens-per-component, MDX-style docs.**
  All separate stories.

---

## Risks

- **Parser scope creep.** Recognising capitalised JSX tags +
  matching their imports requires the parser to maintain
  per-file import-state. Today the parser is largely line-by-line.
  Mitigation: do the import scan as a small pre-pass before the
  element walk; cache results on the parsed output.
- **Atomic multi-file operations are unforgiving.**
  `component:rename` touches a folder + several files + every
  page that imports the component. A partial failure leaves a
  project in a broken intermediate state. Mitigation: stage-
  and-rename pattern (same as the nextjs migrator) — write all
  changes to a sibling staging directory first, swap atomically,
  rollback on any error.
- **Cyclic component graphs through file edits.** A user editing
  a page TSX by hand can introduce `Card → Button → Card` even
  if Scamp's UI blocks it. Mitigation: cycle-detection runs at
  parse time too; cyclic instances render as the missing-component
  placeholder.
- **Save coordination across pages.** When a component changes,
  every page that uses it needs its rendered canvas state to
  refresh — but those pages' element trees in the store don't
  need to change (only the renderer's resolution of the
  component-instance subtree changes). Easy to forget to invalidate
  the right derived state. Mitigation: render instances by
  reaching into the live `componentTrees` map at render time —
  no derived caches between the source and the canvas.
- **Thumbnails coupling to the canvas renderer.** Capturing a
  thumbnail requires the canvas to mount and lay out the
  component briefly. Doing it on every save risks slow saves on
  large components. Mitigation: throttle thumbnail capture to
  one per N seconds per component; render off-screen at a fixed
  size.

---

## Files anticipated (high-level)

| Path | Status |
|---|---|
| `src/renderer/lib/element.ts` | Add `'component-instance'` type + `ComponentInstanceElement` |
| `src/renderer/lib/parseCode.ts` | Recognise component imports + capitalised JSX |
| `src/renderer/lib/generateCode.ts` | Emit instance JSX, import lines, prop type defs |
| `src/renderer/store/canvasSlice.ts` | `ActiveEditTarget`, `componentTrees`, instance-aware reducers |
| `src/renderer/src/components/ComponentEditorBanner.tsx` | NEW |
| `src/renderer/src/components/ComponentsList.tsx` | NEW (sidebar) |
| `src/renderer/src/components/Breadcrumb.tsx` | NEW |
| `src/renderer/src/components/sections/DataSection.tsx` | NEW (panel tab) |
| `src/renderer/src/canvas/ElementRenderer.tsx` | Render instance subtree from component tree |
| `src/main/ipc/component.ts` | NEW (CRUD + rename + lockProp + renameProp + createFromElement) |
| `src/main/ipc/project.ts` | Scan `components/` in `readProjectNextjs` |
| `src/main/watcher.ts` | Emit `project:componentsChanged` (or unify with pagesChanged) |
| `src/shared/agentMd.ts` | Append the Components section from the userstory |
| `src/shared/ipcChannels.ts` | New `Component*` constants |
| `src/shared/types.ts` | `ComponentFile`, `ComponentInstance*Args` |
| `test/component*.test.ts` | Parser/generator round-trip tests per phase |
| `test/integration/componentOps.integration.test.ts` | NEW (atomic multi-file ops) |
| `docs/panel-capabilities.md` | Document the Data tab |

---

## Decision points before implementing

Before Phase 1 kicks off, please confirm:

1. The data-model recommendations in the **Data model** section.
2. The recommendations on each numbered Open Question.
3. The phase ordering (especially that warnings ship in Phase 7,
   after the main flow works — and that we hold off on releasing
   to users until then).
4. Out of scope items — particularly the legacy-format exclusion
   and the text-props-only constraint for v1.
