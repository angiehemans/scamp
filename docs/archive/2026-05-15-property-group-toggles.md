# Toggle CSS Property Groups — Plan

**Status:** Draft for review.
**Date:** 2026-05-15
**Source:** `docs/backlog-5.md` story #2
**Related:** Visual history panel (the toggle action becomes a
history entry per the existing commit pattern), Element states
(the toggle is element-scoped, not state-scoped — see Non-goals
for why), Section component (`Section.tsx` — we extend its
API with an optional group-toggle slot).

---

## Goal

Let users disable an entire section's worth of CSS for an element
in one click, without losing the values they had. The disabled
properties appear as a labelled comment block in the CSS module
file so the on-disk state matches what the user sees in the panel,
and an agent reading the file can see the user's intent.

Concretely:

1. A toggle in each panel section's header flips the whole group
   off / on for the selected element.
2. When off, the canvas renders as if those properties weren't
   set — but the typed values are preserved in memory.
3. The generated CSS emits the off-group properties as a labelled
   `/* layout off */` comment block, after the active properties.
4. The parser recognises those labelled blocks on next file load
   (or agent edit) and rebuilds the toggled-off state.

---

## Current state — what we can build on

- **`Section` component** (`src/renderer/src/components/sections/Section.tsx`).
  Single shared wrapper used by every panel section. Header is a
  `<h3>` (or a `<button>` when collapsible), with two optional dot
  indicators (duplicate-warning, override). The title is always a
  string. Room to add a small toggle button alongside the existing
  dots — same hover/tooltip patterns we use everywhere.
- **One Section per CSS-property group** already exists, almost
  exactly matching the spec's group taxonomy: `PositionSection`,
  `SizeSection`, `LayoutSection`, `SpacingSection`,
  `BackgroundSection`, `BorderSection`, `ShadowsSection`,
  `FiltersSection`, `TypographySection`, `VisibilitySection`,
  `TransitionsSection`, `AnimationSection`. The mapping from
  group name → which `ScampElement` fields → which CSS properties
  is already implicit in each section's `fields` and
  `cssProperties` props.
- **`generateCode.ts`** builds each element's class body as a flat
  `lines: string[]` in `elementDeclarationLines` and joins them at
  the end. Easy to append additional commented-out blocks after
  the active lines without restructuring the emit order.
- **PostCSS exposes comments as first-class nodes**
  (`node.type === 'comment'`). `parseCode.ts` currently iterates
  `root.nodes` filtering for `node.type === 'rule'`. Adding a
  pass that watches for `comment` nodes alongside `rule`s lets us
  detect the labelled blocks.
- **`ElementRenderer.tsx`'s `elementToStyle`** is a single
  function that builds the inline style object. Group-by-group
  branches are already there (sizing, layout, appearance, text,
  visibility, filters). Skipping a group reads as one `if`
  early-out per branch.
- **`ConfirmDialog`** already supports the
  destructive-confirmation flow we need for the sizing warning.
- **Per-state / per-breakpoint typed list pattern** (`boxShadows`,
  `filters`, `transitions`): values live at element level by
  default, overridden via `breakpointOverrides[id].<field>` or
  `stateOverrides[stateName].<field>`. We need to decide whether
  the toggle is element-scoped or per-scope. Recommendation
  below: **element-scoped only** in v1.

What's NOT there yet:

- No field on `ScampElement` tracking toggled-off groups.
- No comment-block parsing in `parseCode`.
- No comment-block emission in `generateCode`.
- No toggle UI in `Section`.
- No skip-on-off logic in `ElementRenderer`.

---

## Non-goals for this story

- **Per-state / per-breakpoint group toggles.** The toggle is a
  whole-element flag — when "Shadow" is off, the element has no
  shadow regardless of which state or breakpoint is active. This
  matches the "preview without these properties" intent; a more
  granular per-scope toggle is a follow-up if anyone asks. The
  data model leaves room to add it (a single optional
  `toggledOffGroups` field on `BreakpointOverride` /
  `StateOverride` would suffice).
- **Toggling `position`.** Backlog spec explicitly excludes it —
  not user-editable as a group, no toggle.
- **Toggling Sizing, Layout, or Visibility.** Deliberate
  deviation from the backlog spec (which listed all three).
  Rationale:
  - **Sizing**: width / height drive the element's box geometry.
    Toggling off collapses the element to zero dimensions or
    `auto` content size, which reads as "broken" rather than
    "previewing without these styles" — especially when the
    parent isn't a flex / grid container.
  - **Layout**: `display` / `flex-direction` / `gap` /
    `align-items` / `justify-content` change how the element
    arranges its children. Toggling off rearranges (or breaks)
    every descendant's layout, which is too much side-effect for
    a "section toggle" affordance.
  - **Visibility**: the section already IS the
    hide / show / opacity surface (`visibility: hidden`,
    `display: none`, `opacity: 0`). Adding a group-level "eye"
    toggle on top would create two ways to "hide" with opposite
    semantics — toggling the section OFF would un-hide a
    previously-hidden element, which inverts the icon's
    affordance.
  Position, Size, Layout, Visibility, and Export therefore
  don't render a section toggle at all. Element is also
  excluded (its controls aren't CSS).
- **Toggling individual properties.** Section-level only. Users
  who want finer control use the raw CSS panel (or delete the
  specific property and let it fall back to default).
- **Toggling properties that are already at their default
  value.** If `boxShadows` is `[]` (default), nothing emits in
  the file — and nothing is there to comment out. The toggle for
  Shadow is still rendered, but flipping it off is a no-op until
  the user actually adds a shadow. Same for every group whose
  fields are at their defaults.
- **A "toggle entire element off" affordance.** Different from
  group toggle; that's what `visibility: hidden` / `display: none`
  are for, and they have their own controls. Out of scope here.
- **Animating the comment block in/out.** The toggle is binary;
  the CSS comments appear or don't.
- **Cross-element bulk toggle** (turn off Shadow for everything).
  Single-element-at-a-time only.

---

## Data model

### New field on `ScampElement`

```ts
// src/renderer/lib/element.ts

/**
 * The fixed taxonomy of "groups" the panel surfaces as section
 * headers. A group name appearing in `ScampElement.toggledOffGroups`
 * means the element's panel section is in the OFF state — the
 * typed values are still stored, but the canvas renders as if
 * they weren't set and the generator emits them as a labelled
 * comment block instead of as active declarations.
 *
 * `position` is intentionally absent — see Non-goals.
 */
// NOTE: deliberate deviation from the backlog spec, which lists
// Sizing, Layout, and Visibility as toggleable groups. We drop
// them because the user-facing semantics are confusing:
//   - Sizing off can collapse the element to zero dimensions.
//   - Layout off (display/flex/grid) breaks parent–child
//     rendering in ways that don't read as "preview without
//     these styles" — they read as "the element is broken".
//   - Visibility already IS the user-facing surface for
//     hide/show via `visibility: hidden` / `display: none`.
//     Toggling the whole Visibility group off would un-hide
//     a previously-hidden element, which is the inverse of
//     what the eye icon would suggest.
// See the Non-goals section for the full reasoning.
export type PropertyGroup =
  | 'background'
  | 'border'
  | 'shadow'
  | 'typography'
  | 'filters'
  | 'blend'
  | 'transitions'
  | 'animation';

export type ScampElement = {
  // ... existing fields ...

  /**
   * Groups currently toggled off for this element. Empty for the
   * common case; non-empty when the user has flipped any
   * section's toggle to OFF. Element-scoped — the toggle applies
   * across all per-state and per-breakpoint overrides too.
   *
   * Order in the array is the emit order of the comment blocks
   * — we sort it canonically on every commit so the file stays
   * text-stable (deduping plus alphabetical, say).
   */
  toggledOffGroups: ReadonlyArray<PropertyGroup>;
};
```

### Group → property mapping

```ts
// src/renderer/lib/propertyGroups.ts

/**
 * Which ScampElement fields belong to which panel-group. This is
 * the single source of truth used by:
 *   - the renderer (skip these styles when group is off)
 *   - the generator (emit these as comments when group is off)
 *   - the parser (when we see the comment block, route values
 *     into these typed fields)
 *
 * Keep in sync with the panel sections.
 */
export const GROUP_FIELDS: Record<PropertyGroup, ReadonlyArray<keyof ScampElement>> = {
  background: ['backgroundColor'], // background-image et al. live in customProperties
  border: ['borderColor', 'borderStyle', 'borderWidth', 'borderRadius'],
  shadow: ['boxShadows'],
  typography: [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'color',
    'textAlign',
    'lineHeight',
    'letterSpacing',
  ],
  filters: ['filters', 'backdropFilters'],
  blend: ['mixBlendMode', 'backgroundBlendMode'],
  transitions: ['transitions'],
  animation: ['animation'],
};

/**
 * Inverse lookup. Maps each ScampElement field to the group it
 * belongs to (if any). Used by the renderer to ask "is this
 * field's group off?" in one O(1) check.
 */
export const FIELD_TO_GROUP: Partial<Record<keyof ScampElement, PropertyGroup>> =
  computeInverse(GROUP_FIELDS);
```

### `customProperties` and the Background group

Background section UI emits `background-image`, `background-size`,
`background-position`, `background-repeat` into
`customProperties` — they're not typed fields on `ScampElement`.
For the Background group toggle we treat those four CSS property
NAMES as "owned by the Background group" alongside the typed
`backgroundColor` field.

```ts
// src/renderer/lib/propertyGroups.ts

/**
 * customProperties keys (CSS property names) owned by each group.
 * Used when emitting the comment block — we walk customProperties
 * and route keys to the right group's comment slot if any.
 */
export const GROUP_CUSTOM_PROPS: Partial<Record<PropertyGroup, ReadonlyArray<string>>> = {
  background: [
    'background-image',
    'background-size',
    'background-position',
    'background-repeat',
  ],
};
```

### Defaults

```ts
// src/renderer/lib/defaults.ts

toggledOffGroups: [] as ReadonlyArray<PropertyGroup>,
```

Empty default means no churn on existing files — the new field
serialises to `0 entries` and the generator emits nothing extra.

### Sort + dedup invariant

Whenever we write to `toggledOffGroups` (commit point in the
store), sort alphabetically and dedup. Two reasons:

- Round-trip text stability — agents that re-save files after
  re-ordering groups don't drift.
- Easy equality check in selectors (`array === array` enough,
  no `Set` allocation needed).

---

## Parse path — `parseCode.ts`

PostCSS exposes comments as nodes with `node.type === 'comment'`
and the comment body in `node.text`. The existing
`parseCssDeclarations` walks `node.type === 'rule'` and calls
`walkDecls`; we widen that to also see comment nodes.

### Recognised comment shape

```css
.rect_a1b2 {
  /* active declarations ... */
  width: 400px;

  /* layout off */
  /* display: flex; */
  /* flex-direction: row; */
  /* gap: 16px; */
  /* align-items: center; */
}
```

Two distinct shapes appear:

- **Group label**: `/* <group> off */` — recognised by exact
  match against the `PropertyGroup` set + the literal word `off`.
  When seen, opens a "this group is being toggled off" capture
  mode for subsequent comments inside the same rule.
- **Commented-out declaration**: `/* prop: value; */` — PostCSS
  preserves this as a `comment` node with the entire `prop:
  value;` in `node.text`. We re-tokenise as a CSS declaration
  via a tiny helper and feed the result through the existing
  `cssPropertyMap`.

The capture mode ends at:
- Another `/* <group> off */` label (different group starts).
- The next non-comment node (e.g. a `decl`).
- The end of the rule.

### Implementation sketch

```ts
// inside parseCssDeclarations or a sibling helper

const declarations: ScampPropertyDelta[] = [];
const toggledOffGroups: PropertyGroup[] = [];
let captureGroup: PropertyGroup | null = null;

for (const node of rule.nodes ?? []) {
  if (node.type === 'comment') {
    const groupMatch = matchGroupLabel(node.text);
    if (groupMatch) {
      captureGroup = groupMatch;
      if (!toggledOffGroups.includes(captureGroup)) {
        toggledOffGroups.push(captureGroup);
      }
      continue;
    }
    if (captureGroup) {
      // Try to parse the comment text as a `prop: value` decl.
      // If it parses, route through cssPropertyMap as if it
      // were active — the typed value is preserved.
      const decl = parseCommentAsDeclaration(node.text);
      if (decl) {
        const delta = cssToScampProperty[decl.prop]?.(decl.value);
        if (delta) declarations.push(delta);
        else customPropsFallback[decl.prop] = decl.value;
      }
    }
    continue;
  }
  if (node.type === 'decl') {
    captureGroup = null; // any real decl ends the capture mode
    // ... existing decl handling ...
  }
}
```

The parser preserves the values inside the comment block as
TYPED state. Toggling back ON in the panel doesn't lose the
data — it just stops emitting the comment block. The generator
then emits the typed values as active declarations.

### Edge cases the parser handles

- **Group label without commented decls** (`/* layout off */`
  followed by nothing): adds `'layout'` to `toggledOffGroups`
  but no values are captured. Still legal; means "the user
  toggled off Layout and Layout had no non-default values to
  preserve".
- **Commented decl before any group label** (a stray
  `/* width: 100px; */` written by an agent): ignored — no
  active capture mode. Round-trips as a verbatim comment via the
  existing comment-preservation path (TBD — confirm there's one;
  otherwise it gets dropped, which is acceptable for unknown
  comment shapes).
- **Comment inside `customProperties`-owned keys**
  (`/* background-image: url(...); */`): the customProperties bag
  needs a paired "commented" variant. See "Generator → customProperties"
  below.

---

## Generate path — `generateCode.ts`

### Two-buffer pattern inside `elementDeclarationLines`

The existing function returns a flat `string[]` of declaration
lines. We refactor it to internally maintain two buffers:

```ts
const activeLines: string[] = [];
const commentedByGroup: Record<PropertyGroup, string[]> = {};

const emit = (group: PropertyGroup | null, line: string): void => {
  if (group !== null && el.toggledOffGroups.includes(group)) {
    (commentedByGroup[group] ??= []).push(`/* ${line} */`);
  } else {
    activeLines.push(line);
  }
};

// ... existing emit logic rewritten to call `emit(group, line)`
//     instead of `lines.push(line)` ...

// After all properties have been routed:
const lines = [...activeLines];
for (const group of el.toggledOffGroups) {
  const block = commentedByGroup[group];
  if (!block || block.length === 0) continue;
  if (lines.length > 0) lines.push(''); // blank-line separator
  lines.push(`/* ${group} off */`);
  lines.push(...block);
}
return lines;
```

Each per-property emit site gets a small change: instead of
`lines.push('box-shadow: …;')`, it calls `emit('shadow',
'box-shadow: …;')`. The function signature of `emit` makes the
group-membership explicit at every call site.

### customProperties owned by groups

For background-image et al. (stored in `customProperties`,
emitted in a loop at the end of `elementDeclarationLines`):

```ts
for (const [key, value] of Object.entries(el.customProperties)) {
  const ownedBy = customPropOwnerGroup(key); // background-image → 'background'
  emit(ownedBy, `${key}: ${value};`);
}
```

When `ownedBy === null` (most custom props don't belong to any
group), `emit` falls into the active path — same behaviour as
today.

### Breakpoint and state override blocks

The same comment-block treatment must work inside `@media`
blocks (breakpoint overrides) and pseudo-class blocks (state
overrides) when those scopes carry their own non-default values
for an off group.

`breakpointOverrideLines()` mirrors `elementDeclarationLines`
shape — it walks the override's typed keys and emits a line per
property. The same two-buffer rewrite applies. Implementation
detail: the same element-level `toggledOffGroups` is consulted
inside both base + override emitters.

If shadow is toggled off AND the element has a hover-state shadow
override, the hover state's emitted block looks like:

```css
.rect_a1b2:hover {
  background: red;

  /* shadow off */
  /* box-shadow: 0px 0px 0px 2px #ffffff; */
}
```

The user sees both shadows (base + hover) commented in their
respective scopes, with no visual rendering — exactly matching
the "preview without that group" intent.

### Animation special case

The Animation group's toggle off commits out the `animation`
property but **leaves `@keyframes` in the file**:

- `@keyframes` blocks live at the page level
  (`pageKeyframesBlocks`), not inside an element's class body —
  so they're naturally untouched by this code.
- A future "Are these keyframes still referenced?" cleanup pass
  is its own story.

---

## Render path — `ElementRenderer.tsx`

The `elementToStyle` function builds the inline style object
group-by-group. For each group we add a single guard:

```ts
const isOff = (group: PropertyGroup): boolean =>
  el.toggledOffGroups.includes(group);

// ... existing branches ...

if (!isOff('shadow') && el.boxShadows.length > 0) {
  base.boxShadow = formatBoxShadowShorthand(el.boxShadows);
}

if (!isOff('filters')) {
  if (el.filters.length > 0) base.filter = formatFilterList(el.filters);
  if (el.backdropFilters.length > 0) {
    base.backdropFilter = formatFilterList(el.backdropFilters);
  }
}

// ... and so on for each group ...
```

For the Background group, the `customProperties` spread at the
end of `elementToStyle` would still apply the background-image
and friends. We add a pre-filter step:

```ts
const visibleCustomProps = isOff('background')
  ? omitKeys(el.customProperties, GROUP_CUSTOM_PROPS.background ?? [])
  : el.customProperties;
const customStyle = customPropsToStyle(visibleCustomProps);
```

### Sizing edge case in the renderer

When sizing is toggled off:

- `widthMode` / `widthValue` etc. read as if absent → fall back
  to layout defaults (i.e. `width: auto` / `height: auto`).
- The element's box may collapse to zero, especially if there
  are no flex/grid parents to give it intrinsic dimensions.
- This is the documented behaviour — the spec calls out the
  warning dialog at toggle-off time. No special renderer
  behaviour needed; collapsed boxes are what the spec describes.

### Selection outline still rendered

The selection outline (`.selected` class in
`ElementRenderer.module.css`) is editor chrome, not styled CSS.
It renders on toggled-off elements as normal — the user still
sees what they have selected. The recent export fix (strip
`.selected` during capture) is unaffected.

---

## UI — section toggles

### Extending `Section`

Add an optional prop:

```ts
type Props = {
  // ... existing props ...

  /**
   * Group-toggle slot. When provided, the section's title row
   * renders a small toggle button that flips the whole group
   * off / on. The section's content dims (reduced opacity,
   * pointer-events disabled) when `isOn` is false to make the
   * inactive state obvious.
   *
   * Sections that aren't part of the property-group taxonomy
   * (e.g. Element, Position, Export) omit this prop and the
   * toggle isn't rendered.
   */
  groupToggle?: {
    isOn: boolean;
    onChange: (on: boolean) => void;
  };
};
```

Header layout becomes:

```
┌──────────────────────────────────────┐
│  ▾ Layout    [👁]   [⚠]  [●]         │
└──────────────────────────────────────┘
   collapse   toggle  dup  override
```

- `[👁]` is an `IconEye` / `IconEyeOff` from Tabler. Click flips
  the group toggle.
- The toggle button is keyboard-accessible (focusable, Enter /
  Space activate).
- Tooltip on the button reads `"Hide Layout"` / `"Show Layout"`.

When `isOn === false`:

- Section content gets `opacity: 0.5; pointer-events: none;`
  (or a CSS class with those rules).
- The title's icon flips to `IconEyeOff`.
- The collapse caret is still functional — the user can still
  collapse the dimmed section if they want to clean up the
  panel.

### Per-section toggle bindings

Each section reads `element.toggledOffGroups` from the resolved
element and passes the group name to `Section`:

```tsx
// ShadowsSection
const isOn = !element.toggledOffGroups.includes('shadow');
const toggleGroup = useCanvasStore((s) => s.togglePropertyGroup);
return (
  <Section
    title="Shadow"
    groupToggle={{
      isOn,
      onChange: (on) => toggleGroup(elementId, 'shadow', on),
    }}
    // ... existing props ...
  >
    {/* existing content */}
  </Section>
);
```

Sections without `groupToggle` (Element, Position, Size, Layout,
Visibility, Export) render exactly as before — no eye icon, no
dimmed-content behaviour.

`togglePropertyGroup(elementId, group, on)` is a new store
action: adds or removes the group from the element's
`toggledOffGroups` array, sorts canonically, commits a history
entry tagged `kind: 'patch'` with `propertyKeys:
['toggledOffGroups']` so the history panel reads "Changed
toggledOffGroups — rect_a1b2". (We can refine that label later;
the history kind doesn't need to be its own thing.)

---

## Tests

### Unit tests

New file: `test/propertyGroupToggle.test.ts`.

```ts
describe('propertyGroups taxonomy', () => {
  it('every PropertyGroup is keyed in GROUP_FIELDS', () => {});
  it('FIELD_TO_GROUP is the inverse of GROUP_FIELDS', () => {});
  it('the union of all groups\' fields is disjoint (no field in two groups)', () => {});
});

describe('togglePropertyGroup (store action)', () => {
  it('adding a group sorts the result canonically', () => {});
  it('dedupes when a group is toggled off twice', () => {});
  it('removing a group leaves the array sorted', () => {});
  it('commits a history entry tagged as a patch', () => {});
});
```

New file: `test/parsePropertyGroupComments.test.ts`.

```ts
describe('parseCode — toggled-off group comment blocks', () => {
  it('reads /* layout off */ and adds layout to toggledOffGroups', () => {});
  it('parses commented-out decls inside the block into typed state', () => {});
  it('ends capture mode at the next non-comment node', () => {});
  it('starts a new capture mode when a second /* X off */ appears', () => {});
  it('ignores commented decls that appear without a preceding group label', () => {});
  it('round-trips: parse → generate → parse → same toggledOffGroups + same typed values', () => {});
});
```

New file: `test/generatePropertyGroupComments.test.ts`.

```ts
describe('generateCode — toggled-off groups emit comments', () => {
  it('emits /* layout off */ followed by /* display: flex; */ ... when layout is off', () => {});
  it('omits a comment block when the off group has no non-default values', () => {});
  it('orders groups alphabetically in the emitted comment blocks', () => {});
  it('omits the active background-color declaration when background group is off', () => {});
  it('emits the commented background-color declaration in the off block', () => {});
  it('emits comment blocks inside breakpoint @media blocks when overrides exist for an off group', () => {});
  it('animation off comments out the animation declaration but leaves @keyframes alone', () => {});
});
```

### Round-trip integration test

Extend `test/integration/sync.integration.test.ts`:

- Author a page with an element that has `display: flex` and a
  toggled-off Layout group → write → reload → assert the
  toggled-off state survives + the `display` value is still
  parsed into the typed field.

### UI e2e (Playwright)

`test/e2e/properties-panel/group-toggle.spec.ts`:

- Toggle Shadow off → assert the canvas element has no
  `box-shadow` inline style.
- Toggle Shadow on again → the inline style returns.
- Assert the section dims visually when off.
- Sizing warning dialog: trigger off, accept, assert sizing
  emits a comment block.
- Stretch-mode disabled state: assert the toggle is
  non-interactive when widthMode === 'stretch'.

---

## Implementation order

Bottom-up. Each step ships with passing tests before the next.

1. **`PropertyGroup` taxonomy module.**
   `src/renderer/lib/propertyGroups.ts` exports `PropertyGroup`
   (union type), `GROUP_FIELDS`, `FIELD_TO_GROUP`,
   `GROUP_CUSTOM_PROPS`. Unit tests for the taxonomy
   invariants (every group keyed, inverse is correct, no
   field in two groups).

2. **`ScampElement.toggledOffGroups` field.** Add the field +
   `[]` default in `DEFAULT_RECT_STYLES` and `DEFAULT_ROOT_STYLES`.
   Update `cloneElementSubtree`'s defensive-copy block (`.slice()`
   the array). Update inline element-fixture tests across the
   suite — same mechanical edit the box-shadow / filter plans
   touched. Build passes; no runtime effect yet.

3. **Store action.** `togglePropertyGroup(id, group, on)` in
   `canvasSlice.ts`. Patches the element, sorts the result, and
   calls `commitElementsToHistory` with kind `patch`,
   `propertyKeys: ['toggledOffGroups']`. Unit tests for the
   sort + dedup invariants.

4. **`Section` extension.** Add the optional `groupToggle` prop.
   Render an `IconEye` / `IconEyeOff` button when provided.
   Section content gets a `.dimmed` class when `isOn === false`.
   No data wiring yet — purely a UI extension. Storybook-style
   manual test by hand-feeding `groupToggle` props.

5. **Generator — two-buffer rewrite.** Refactor
   `elementDeclarationLines` to use the `emit(group, line)`
   helper internally. No external behaviour change yet — when
   `toggledOffGroups` is empty (default), output is byte-for-byte
   identical. Existing generator tests pass unchanged.
   Add new generator tests for the off-group emit cases.

6. **Generator — comment-block emit.** With the refactor in
   place, populate the comment blocks at the end of
   `elementDeclarationLines`. Same treatment in
   `breakpointOverrideLines`. Tests in
   `test/generatePropertyGroupComments.test.ts`.

7. **Parser — comment-block recognition.** Widen the
   declarations walk to see `comment` nodes. Implement the
   label-detect + capture-mode + decl-parse flow. Tests in
   `test/parsePropertyGroupComments.test.ts`. Add a round-trip
   integration test that survives a save+reload cycle.

8. **Renderer — skip styles for off groups.** Add the
   `isOff(group)` guards to `elementToStyle`'s branches. Verify
   visually that toggling Shadow off removes the shadow on the
   canvas; toggling Background off removes the colour + image.

9. **Section wiring.** Update each toggleable section component
   (`BackgroundSection`, `BorderSection`, `ShadowsSection`,
   `FiltersSection`, `TypographySection`, `TransitionsSection`,
   `AnimationSection`, and the blend-mode dropdown's section)
   to read `element.toggledOffGroups`, pass `groupToggle` to
   `Section`, and call `togglePropertyGroup` on change.
   Sections that aren't groups (Element, Position, Size,
   Layout, Visibility, Export) skip this.

10. **Polish.** Tooltips on the toggle button. The dimmed
    section's CSS rules. Hover feedback. Maybe a small
    animation for the icon flip.

11. **Agent.md update.** Document the exact comment label
    format (`/* <group> off */`) and stress that agents must
    preserve them verbatim. Document the per-group property
    membership so agents can decide which comments to write
    when manipulating CSS. Call out that Position, Size,
    Layout, and Visibility are explicitly NOT toggleable so
    agents don't write speculative `/* layout off */` blocks
    Scamp won't recognise.

12. **Tests.** All unit, integration, and e2e tests written
    alongside their implementation step (above) should be
    green at this point. Confirm full suite + typecheck +
    build.

---

## Risks and edge cases

- **Property in two groups.** Conceptually possible
  (`padding` could plausibly belong to Layout OR Spacing); the
  spec's table puts `padding` in Layout. The taxonomy is the
  source of truth — we enforce disjointness in unit tests.
  If the spec evolves, the test fails and forces a deliberate
  taxonomy update.
- **Default-value emit suppression.** A field at its default
  doesn't emit. A toggled-off group containing only
  default-valued fields therefore emits a `/* layout off */`
  label with no commented decls beneath it. Two options:
  (a) emit the bare label so `parseCode` still recognises
  the toggled-off state, (b) skip the block entirely and treat
  toggled-off-with-empty as toggled-on. Option (a) preserves
  user intent across save/load with no visual difference;
  option (b) hides intent in some cases. Recommend (a).
- **PostCSS comment-text whitespace.** The spec says the label
  is exact (`/* layout off */`). PostCSS's `comment.text`
  usually has leading/trailing whitespace stripped, but the
  exact format varies. Match case-insensitively against
  `^\s*([a-z]+)\s+off\s*$` after lowercasing — robust to
  whitespace, strict on word boundaries.
- **Round-trip stability when properties at defaults.** If
  the user adds a non-default value to Layout, toggles off,
  saves; then later removes the value (by typing a default
  into the input), the comment block now has nothing inside
  it. We re-emit the bare label per the (a) decision above.
  Consistent text on disk; no drift.
- **History panel labels.** Toggling a group flips
  `toggledOffGroups`, which is a `patch` history entry with
  `propertyKeys: ['toggledOffGroups']`. The default label
  would read "Changed toggledOffGroups — rect_a1b2", which is
  ugly. Add a custom history kind `'toggle-group'` with
  metadata `{ group, on }` so the panel reads "Hid Layout —
  rect_a1b2" / "Showed Layout — rect_a1b2".
- **Sections without a toggle.** Element (not CSS), Position
  (excluded by backlog spec), Size / Layout / Visibility
  (excluded for UX-confusion reasons — see Non-goals), and
  Export (not a styling section) all render without the eye
  icon. Their headers look exactly like they do today.
- **Image elements with the Border group toggled off.** Border
  on `<img>` is uncommon but valid; the toggle works the same
  as for rectangles. No image-specific handling.

---

## Open questions for review

1. **Element-scoped vs per-scope toggle.** Recommendation:
   start with **element-scoped** (the toggle applies across
   base + all per-state and per-breakpoint overrides). The
   data model leaves room to extend to per-scope later if
   anyone asks. Confirm. agreed

2. **Bare-label round-trip when no commented decls.** Should
   `/* layout off */` with no commented declarations beneath
   it (because all fields are at defaults) be (a) emitted to
   preserve the user's toggle intent, or (b) skipped because
   the visual outcome is identical to toggled-on? Recommend
   (a) — preserves intent. Confirm. Agreed

3. **Custom history kind for group toggles.** Recommend a
   dedicated `'toggle-group'` history-action-kind so the panel
   reads "Hid Layout" / "Showed Layout" instead of the generic
   "Changed toggledOffGroups". Confirm — alternative is to
   live with the generic label and add the polish later. Agreed

4. **Sizing warning when parent is flex/grid.** Moot — Sizing
   is no longer a toggleable group (see Non-goals), so the
   warning dialog isn't needed at all.

5. **Section toggle icon.** `IconEye` / `IconEyeOff` is my
   pick. Alternatives: `IconToggleLeft` / `IconToggleRight`,
   `IconCircleDot` / `IconCircle`, or a custom power-switch
   shape. The eye reads as "visibility of this group", which
   matches the feature semantics nicely. Confirm or pick
   alternative. yes the eye icons

6. **Dimmed section interaction.** When a section is dimmed
   (off), should the controls inside be (a)
   `pointer-events: none` so the user can't accidentally edit
   them, or (b) still interactive — edits update the typed
   state but the canvas still shows the off behaviour?
   Recommendation: (a) — disabling matches user expectation;
   editing-while-off is confusing. The user toggles on first,
   edits, toggles off again. Confirm. go with A

7. **The visibility group's interaction with the
   `visibilityMode === 'none'` value.** Moot — Visibility is
   no longer a toggleable group (see Non-goals), so this
   inversion-of-affordance issue can't arise.

8. **Animation group: comment but keep @keyframes.** Plan
   says yes (keyframes are page-level and untouched). But:
   should we add a note in the panel — "@keyframes is kept;
   toggle on to use again" — so the user understands the
   on-disk shape? Recommend skip the in-panel note for v1
   (the keyframes-untouched behaviour is the natural one);
   add the note only if it surprises users in testing. agreed

9. **Persistence across page-switch / external-edit / undo.**
   `toggledOffGroups` is a normal element field; it survives
   page switches, external edits (re-parsed from the
   comment-block markers), and undo/redo (history entries
   capture the snapshot). No special handling beyond what the
   field-level mechanics already do. Confirm. agreed

10. **Order of comment blocks within a rule.** My plan emits
    them at the END of the rule body, after all active
    declarations. The spec's example matches this. Confirm —
    alternative is interleaved with active properties at each
    group's "natural position" in the emit order, but that
    makes the file harder to read. Agreed
