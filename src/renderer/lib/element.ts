/**
 * Canonical canvas element type. Mirrors the Element shape from prd-scamp-poc.md
 * §"Zustand State Shape". Both `generateCode` and `parseCode` (added in M3)
 * operate on a flat `Record<string, ScampElement>` keyed by id.
 */

export type WidthMode = 'fixed' | 'stretch' | 'fit-content' | 'auto';
export type HeightMode = 'fixed' | 'stretch' | 'fit-content' | 'auto';
/**
 * `display` values the panel models directly. `'none'` here is the
 * "block" mode (no flex / no grid layout) — visibility:none is a
 * separate concept in `visibilityMode`. Naming keeps the legacy
 * meaning of `'none'` as "neither flex nor grid" so existing files
 * round-trip.
 */
export type DisplayMode = 'none' | 'flex' | 'grid';
export type FlexDirection = 'row' | 'column';
export type AlignItems = 'flex-start' | 'center' | 'flex-end' | 'stretch';
export type JustifyContent =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around';
/**
 * Used for grid-only alignment controls (`justify-items`,
 * `align-self`, `justify-self`). Modern CSS accepts the same short
 * keywords on grid containers AND the longer `flex-start`/`flex-end`
 * on grid containers, so the existing flex-flavoured `alignItems`
 * field keeps working untouched on grid elements.
 */
export type GridSelfAlign = 'start' | 'center' | 'end' | 'stretch';
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';
/**
 * CSS `position`. `'auto'` is a Scamp-only sentinel meaning "let
 * Scamp pick" — the generator emits `position: relative` for the
 * page root, `position: absolute` for non-flex/non-grid children,
 * and no declaration at all for flex/grid children. Setting any
 * other value pins it: that value is emitted exactly as written.
 */
export type Position =
  | 'auto'
  | 'static'
  | 'relative'
  | 'absolute'
  | 'fixed'
  | 'sticky';
export type FontWeight = 400 | 500 | 600 | 700;
export type TextAlign = 'left' | 'center' | 'right';

export type ElementType = 'rectangle' | 'text' | 'image' | 'input';

/**
 * One non-Scamp inline fragment between (or around) the element
 * children of a Scamp parent — either a loose text node or an
 * unclassed JSX subtree captured verbatim from the source. Preserved
 * in DOM source order so the generator can interleave them with
 * element children at emit time.
 *
 * `afterChildIndex`:
 *   -1 → before the parent's first element child
 *    n → after `parent.childIds[n]`
 *
 * Multiple fragments at the same index are emitted in capture order.
 */
export type InlineFragment =
  | { kind: 'text'; value: string; afterChildIndex: number }
  | { kind: 'jsx'; source: string; afterChildIndex: number };

/**
 * The named easing keywords the WYSIWYG dropdown offers. The parser
 * also accepts arbitrary `cubic-bezier(...)` expressions and stores
 * them verbatim in this same field — the panel renders those as the
 * `Custom…` row.
 */
export type TransitionEasing =
  | 'ease'
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | string;

/**
 * One row of the Transitions section. The CSS shorthand
 * `transition: opacity 200ms ease, transform 300ms ease-in-out 100ms`
 * round-trips as a list of these.
 *
 * Duration and delay are stored in canonical milliseconds. The UI
 * tracks the user's preferred unit (ms vs s) in component-local
 * state so they can toggle without a stored field.
 *
 * `property` is a free-form string at the data layer so that
 * agent-written transitions on properties outside the dropdown set
 * (e.g. `box-shadow`) round-trip cleanly. The UI surface restricts
 * the dropdown options.
 */
export type TransitionDef = {
  property: string;
  durationMs: number;
  easing: TransitionEasing;
  delayMs: number;
};

/**
 * One entry in a `<select>` element's option list. Options are not
 * canvas elements — they're managed as a typed list on the parent
 * select element and emitted as inline JSX children at generate time.
 */
export type SelectOption = {
  value: string;
  label: string;
  selected?: boolean;
};

export type ScampElement = {
  id: string;
  type: ElementType;
  parentId: string | null;
  childIds: string[];

  /**
   * Optional HTML tag override. When undefined, the element renders /
   * generates as the default for its type:
   *   - rectangles → `div`
   *   - text → `p`
   *   - image → `img`
   *   - input → `input`
   *
   * Setting this lets agents and hand-written files use semantic tags
   * like `h1`, `h2`, `section`, `header`, `nav`, etc. — the parser
   * captures whatever's in the file, the generator emits it back, and
   * the canvas renders the real tag (so styles like h1's default font
   * size match what the user will see in production).
   */
  tag?: string;

  /**
   * Generic HTML attribute bag — mirrors how `customProperties` works
   * for CSS. Tag-specific panel fields write here (`href`, `target`,
   * `method`, `action`, `datetime`, `for`, `cite`, `controls`,
   * `autoplay`, `type` for button/input, etc.) and the parser collects
   * any attribute it isn't already typed to handle. Boolean attributes
   * are stored as the empty string `""` and emitted bare.
   */
  attributes?: Record<string, string>;

  /**
   * Only meaningful when `tag === 'select'`. The options the select
   * renders. Stored as a list on the element rather than as nested
   * canvas elements so they can be edited inline in the properties
   * panel without cluttering the layers tree.
   */
  selectOptions?: ReadonlyArray<SelectOption>;

  /**
   * Only meaningful when `tag === 'svg'`. The raw inner source between
   * the `<svg>` open and close tags, preserved verbatim so the
   * generator can re-emit it byte-for-byte. The canvas does NOT render
   * this — svg elements show as placeholder rectangles on the canvas.
   */
  svgSource?: string;

  /**
   * Optional human-readable name. When set, the slugified version
   * replaces the default `rect` / `text` prefix in the generated CSS
   * class name (e.g. "Hero Card" → `hero-card_a1b2`). The name is
   * stored as a `data-scamp-name` attribute in the TSX and round-trips
   * through parseCode.
   */
  name?: string;

  // Sizing
  widthMode: WidthMode;
  widthValue: number;
  heightMode: HeightMode;
  heightValue: number;

  // Position
  x: number;
  y: number;
  /**
   * `position` mode. Default `'auto'` lets the generator pick based
   * on tree shape (root → relative, non-flex child → absolute, flex
   * child → none). Any other value pins the position and gets
   * emitted as-is. Useful for sticky navbars, fixed overlays, etc.
   */
  position: Position;

  // Layout (as container)
  display: DisplayMode;
  flexDirection: FlexDirection;
  gap: number;
  alignItems: AlignItems;
  justifyContent: JustifyContent;

  /**
   * Grid-only container fields. Free-text template strings (so
   * `repeat(3, 1fr)`, `auto-fill`, `minmax(...)`, etc. round-trip
   * unmolested) and per-axis gaps in pixels. `justifyItems` is grid-
   * only — flex uses `justifyContent` for the same axis.
   */
  gridTemplateColumns: string;
  gridTemplateRows: string;
  columnGap: number;
  rowGap: number;
  justifyItems: GridSelfAlign;

  /**
   * Grid-item fields — applied when this element's PARENT is a grid
   * container. Free-text `gridColumn` / `gridRow` so `span 2`,
   * `1 / 3`, named-line refs etc. round-trip.
   */
  gridColumn: string;
  gridRow: string;
  alignSelf: GridSelfAlign;
  justifySelf: GridSelfAlign;

  padding: [number, number, number, number];
  margin: [number, number, number, number];

  // Appearance
  backgroundColor: string;
  borderRadius: [number, number, number, number];
  borderWidth: [number, number, number, number];
  borderStyle: BorderStyle;
  borderColor: string;

  /** CSS `opacity` as a 0..1 number. Default 1. */
  opacity: number;
  /**
   * Visibility state. Maps to CSS as:
   *   - 'visible' → no declaration emitted
   *   - 'hidden'  → `visibility: hidden;`
   *   - 'none'    → `display: none;` (suppresses flex emits)
   */
  visibilityMode: 'visible' | 'hidden' | 'none';

  // Text only
  text?: string;
  fontFamily?: string;
  /**
   * Full CSS `font-size` value, e.g. `"16px"`, `"1rem"`, or a token
   * reference like `"var(--text-lg)"`. Stored as a string so token
   * refs and non-px units round-trip without a parallel "raw" field.
   */
  fontSize?: string;
  fontWeight?: FontWeight;
  color?: string;
  textAlign?: TextAlign;
  /** CSS `line-height` — unitless number (`"1.5"`), length (`"20px"`),
   * or a token reference (`"var(--leading-normal)"`). */
  lineHeight?: string;
  /** CSS `letter-spacing` — length or token reference. */
  letterSpacing?: string;

  // Image only
  src?: string;
  alt?: string;

  /**
   * Ordered list of CSS transitions. Empty by default. Emitted as a
   * single `transition: a, b, c` shorthand when non-empty; the
   * parser handles the shorthand AND the longhand form in case an
   * agent writes them split.
   */
  transitions: ReadonlyArray<TransitionDef>;

  /**
   * Loose text and unclassed JSX between this element's child
   * elements, preserved in DOM source order. Empty by default.
   * Populated by `parseCode` when an agent writes mixed
   * text-and-element children inside a non-text container; the
   * generator interleaves these with `childIds` at emit time so
   * the output round-trips byte-equivalent. The layers panel
   * surfaces them in a "Raw" group so the user can see the
   * fragments exist (they're not directly editable from the
   * canvas).
   */
  inlineFragments: ReadonlyArray<InlineFragment>;

  // Passthrough — properties the canvas can't visually represent
  customProperties: Record<string, string>;

  /**
   * Per-breakpoint style overrides keyed by breakpoint id (matching
   * entries in `ProjectConfig.breakpoints`). Each value carries ONLY
   * the fields the user overrode at that breakpoint — everything
   * else cascades from the base (desktop) styles on this element.
   *
   * Desktop is not stored here: it's the element's top-level fields.
   * When a breakpoint's override object would become empty (all
   * overrides removed), the key is deleted so round-trips stay
   * text-stable.
   */
  breakpointOverrides?: Record<string, BreakpointOverride>;

  /**
   * Per-state style overrides for the recognised CSS pseudo-classes
   * (`hover`, `active`, `focus`). Each value carries ONLY the fields
   * the user changed for that state — everything else cascades from
   * the base ("rest") styles on this element. Default state isn't
   * stored here: it's the element's top-level fields.
   *
   * Empty / fully-cleared override keys are dropped, and the entire
   * `stateOverrides` map is cleared back to `undefined` when no state
   * has any overrides, so round-trips stay text-stable.
   *
   * Desktop-only in this version — combining with breakpoints lands
   * later (see `docs/plans/2026-04-30-element-states.md`).
   */
  stateOverrides?: Partial<Record<ElementStateName, StateOverride>>;

  /**
   * Pseudo-class blocks the parser couldn't route to a recognised
   * state (`:focus-visible`, `:checked`, `:disabled`, `:nth-child(...)`,
   * compound selectors like `.rect_a1b2:hover .child`, etc.). Stored
   * verbatim so the generator can re-emit them after the element's
   * recognised state blocks. Empty / undefined when the source CSS
   * had nothing exotic for this class.
   */
  customSelectorBlocks?: ReadonlyArray<RawSelectorBlock>;
};

/**
 * Which `ScampElement` fields a breakpoint can override. Excludes
 * identity / tree fields (id, type, parentId, childIds) and the
 * override map itself — a breakpoint can't re-parent an element or
 * nest its own overrides. Also excludes TSX-level fields (tag,
 * attributes, selectOptions, svgSource) and the `text` content —
 * breakpoints change CSS only.
 *
 * `stateOverrides` and `customSelectorBlocks` are excluded too: a
 * breakpoint can't itself carry per-state overrides in this version
 * (the matrix is deferred — see the element-states plan), and the
 * raw-selector passthrough lives only at the top level.
 */
export type BreakpointOverride = Partial<
  Omit<
    ScampElement,
    | 'id'
    | 'type'
    | 'parentId'
    | 'childIds'
    | 'breakpointOverrides'
    | 'stateOverrides'
    | 'customSelectorBlocks'
    | 'tag'
    | 'attributes'
    | 'selectOptions'
    | 'svgSource'
    | 'text'
    | 'name'
  >
>;

/**
 * The fixed set of CSS pseudo-classes Scamp models as first-class
 * "states" with typed per-field overrides. Other pseudo-classes
 * (`:focus-visible`, `:disabled`, `:checked`, `:nth-child(...)`,
 * compound selectors) are preserved verbatim via
 * `customSelectorBlocks` rather than parsed into typed overrides.
 *
 * Order matters for emit: `:hover` → `:active` → `:focus` matches
 * the LVHA-ish ordering convention so cascade resolution is
 * predictable. Keep new entries in the same intended-emit order.
 */
export type ElementStateName = 'hover' | 'active' | 'focus';

export const ELEMENT_STATES: ReadonlyArray<ElementStateName> = [
  'hover',
  'active',
  'focus',
];

/**
 * Subset of element fields a per-state override can carry. Identical
 * shape to `BreakpointOverride` so the parser and generator can reuse
 * the same field-emit logic for both axes.
 *
 * The properties panel deliberately doesn't expose `position` / `x`
 * / `y` / `transitions` controls when a non-default state is active
 * (hover layout shifts are bad UX; per-state transitions are a
 * separate feature). That UI rule lives in the section components,
 * not in this type — preserving anything an agent hand-writes inside
 * a pseudo-class block is more important than blocking it at the
 * type boundary.
 */
export type StateOverride = BreakpointOverride;

/**
 * One pseudo-class rule the parser couldn't route into a typed state
 * override — preserved verbatim so the generator can re-emit it
 * unchanged. Selector includes the leading `.<className>` so we know
 * which element this block belongs to; `body` is the declaration list
 * (just the inner declarations, no braces) formatted as the source had
 * it.
 */
export type RawSelectorBlock = {
  selector: string;
  body: string;
};

/**
 * The id used for the implicit page-root element. Stays constant across
 * all pages so other code can rely on a known anchor.
 */
export const ROOT_ELEMENT_ID = 'root';

/**
 * Generate a 4-character lowercase hex id, matching the format used in the
 * generated CSS class names (`rect_a1b2`).
 */
export const generateElementId = (): string => {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 4; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

/**
 * Slugify a user-given element name into a valid CSS class prefix.
 * Lowercases, replaces spaces with hyphens, strips anything that isn't
 * alphanumeric or a hyphen. Returns an empty string if the result is
 * empty (caller falls back to the default type prefix).
 *
 * CSS identifiers can't start with a digit, so a leading digit gets
 * prefixed with `_`.
 */
export const slugifyName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
  if (slug.length === 0) return '';
  // CSS identifiers can't start with a digit.
  if (/^[0-9]/.test(slug)) return `_${slug}`;
  return slug;
};

/**
 * Move an element to a new parent and/or position within its current parent.
 *
 * Pure: returns a new elements map. Returns null when the move isn't valid:
 *   - moving the root element
 *   - moving an element into itself or any of its descendants (would
 *     create a cycle in the tree)
 *   - referencing a non-existent element or parent
 *
 * `newIndex` is the position in the *destination* parent's `childIds` AFTER
 * the move. When the destination parent is the same as the current parent
 * and the new index is past the element's current slot, the function adjusts
 * for the removal so callers can pass "the slot the user dropped on" without
 * worrying about off-by-one math.
 */
export const reorderElementPure = (
  elements: Record<string, ScampElement>,
  elementId: string,
  newParentId: string,
  newIndex: number
): Record<string, ScampElement> | null => {
  if (elementId === ROOT_ELEMENT_ID) return null;
  const el = elements[elementId];
  if (!el || !el.parentId) return null;

  const newParent = elements[newParentId];
  if (!newParent) return null;

  // Cycle check: walk newParent's ancestor chain looking for elementId.
  let cursor: string | null = newParentId;
  while (cursor) {
    if (cursor === elementId) return null;
    cursor = elements[cursor]?.parentId ?? null;
  }

  const oldParentId = el.parentId;
  const next: Record<string, ScampElement> = { ...elements };

  if (oldParentId === newParentId) {
    // Same parent: a single splice + reinsert in one shot.
    const parent = elements[newParentId]!;
    const oldIdx = parent.childIds.indexOf(elementId);
    if (oldIdx < 0) return null;
    // Adjust the destination index to account for the removal happening
    // BEFORE the insert when moving forward.
    let dest = Math.max(0, Math.min(parent.childIds.length, newIndex));
    if (oldIdx < dest) dest -= 1;
    if (dest === oldIdx) return next; // no-op move
    const childIds = [...parent.childIds];
    childIds.splice(oldIdx, 1);
    childIds.splice(dest, 0, elementId);
    next[newParentId] = { ...parent, childIds };
    return next;
  }

  // Different parents.
  const oldParent = elements[oldParentId];
  if (!oldParent) return null;
  next[oldParentId] = {
    ...oldParent,
    childIds: oldParent.childIds.filter((id) => id !== elementId),
  };
  const dest = Math.max(0, Math.min(newParent.childIds.length, newIndex));
  const newChildIds = [...newParent.childIds];
  newChildIds.splice(dest, 0, elementId);
  next[newParentId] = { ...newParent, childIds: newChildIds };
  next[elementId] = { ...el, parentId: newParentId };
  return next;
};

/**
 * Wrap a contiguous-by-parent set of sibling element ids in a new flex
 * container. Pure: takes the current elements map and returns a new one,
 * leaving the input untouched. Returns null when the operation isn't
 * meaningful (no ids, mixed parents, root in the set).
 *
 * The returned `elements` map has:
 *   - the new group element keyed by `groupId`
 *   - the moved children with `parentId` set to `groupId` and `x/y` reset
 *     to 0 (they're flex items now)
 *   - the original parent's `childIds` updated to contain `groupId` in
 *     place of the run of grouped ids
 *
 * Bounding box: when the parent is a non-flex container, the new group is
 * placed at the bounding box of the selected children's stored x/y. When
 * the parent is itself flex, the group's x/y is 0 (flex layout owns it).
 */
export const groupSiblings = (
  elements: Record<string, ScampElement>,
  ids: readonly string[],
  groupId: string
): { elements: Record<string, ScampElement>; groupId: string } | null => {
  if (ids.length === 0) return null;
  if (ids.includes(ROOT_ELEMENT_ID)) return null;

  // Validate every id exists and shares the same parent.
  const first = elements[ids[0]!];
  if (!first || !first.parentId) return null;
  const parentId = first.parentId;
  for (const id of ids) {
    const el = elements[id];
    if (!el) return null;
    if (el.parentId !== parentId) return null;
  }

  const parent = elements[parentId];
  if (!parent) return null;

  // Order the selected ids by their position in the parent's childIds so
  // grouping never reorders them.
  const idSet = new Set(ids);
  const ordered = parent.childIds.filter((id) => idSet.has(id));
  if (ordered.length === 0) return null;

  const isFlexParent = parent.display === 'flex';

  // Compute the bounding box from stored coordinates (only meaningful when
  // the parent is non-flex). Flex parents place children via layout flow
  // so x/y is 0 anyway.
  let groupX = 0;
  let groupY = 0;
  let groupW = 200;
  let groupH = 200;
  if (!isFlexParent) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const id of ordered) {
      const el = elements[id]!;
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.widthValue > maxX) maxX = el.x + el.widthValue;
      if (el.y + el.heightValue > maxY) maxY = el.y + el.heightValue;
    }
    groupX = Math.round(minX);
    groupY = Math.round(minY);
    groupW = Math.max(20, Math.round(maxX - minX));
    groupH = Math.max(20, Math.round(maxY - minY));
  }

  const group: ScampElement = {
    id: groupId,
    type: 'rectangle',
    parentId,
    childIds: [...ordered],
    // Groups default to `fit-content` on both axes so the wrapper hugs
    // the children visually. The bounding-box derived widthValue /
    // heightValue is still kept around as a sensible "fixed" fallback
    // in case the user switches the group out of fit-content later.
    widthMode: 'fit-content',
    widthValue: groupW,
    heightMode: 'fit-content',
    heightValue: groupH,
    x: groupX,
    y: groupY,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gridTemplateColumns: '',
    gridTemplateRows: '',
    columnGap: 0,
    rowGap: 0,
    justifyItems: 'stretch',
    gridColumn: '',
    gridRow: '',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    backgroundColor: 'transparent',
    borderRadius: [0, 0, 0, 0],
    borderWidth: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: '#000000',
    opacity: 1,
    visibilityMode: 'visible',
    position: 'auto',
    transitions: [],
    inlineFragments: [],
    customProperties: {},
  };

  // Build the next elements map.
  const next: Record<string, ScampElement> = { ...elements };

  // Update the parent: replace the run of grouped children with the group.
  const firstIdx = parent.childIds.indexOf(ordered[0]!);
  const newParentChildIds = parent.childIds.filter((id) => !idSet.has(id));
  newParentChildIds.splice(firstIdx, 0, groupId);
  next[parentId] = { ...parent, childIds: newParentChildIds };

  // Re-parent each grouped child onto the new group with x/y reset.
  for (const id of ordered) {
    const child = elements[id]!;
    next[id] = { ...child, parentId: groupId, x: 0, y: 0 };
  }

  next[groupId] = group;

  return { elements: next, groupId };
};

/**
 * Inverse of `groupSiblings`: remove an element from the tree and promote
 * its children to take its place in its grandparent. Pure. Returns null
 * if `id` is the root, has no parent, or has no children to promote.
 *
 * If the ungrouped element was a flex container inside a non-flex parent,
 * children are translated by the group's stored (x, y) so they roughly
 * stay where the user saw them. Otherwise their x/y carry over directly.
 */
export const ungroupSiblings = (
  elements: Record<string, ScampElement>,
  id: string
): { elements: Record<string, ScampElement>; promotedIds: string[] } | null => {
  if (id === ROOT_ELEMENT_ID) return null;
  const target = elements[id];
  if (!target || !target.parentId) return null;
  if (target.childIds.length === 0) return null;

  const parent = elements[target.parentId];
  if (!parent) return null;

  const parentIsFlex = parent.display === 'flex';
  const targetIsFlex = target.display === 'flex';

  // Splice the target's children into the parent's childIds at the
  // target's position, in their original order.
  const idx = parent.childIds.indexOf(id);
  const newParentChildIds = [...parent.childIds];
  if (idx >= 0) {
    newParentChildIds.splice(idx, 1, ...target.childIds);
  }

  const next: Record<string, ScampElement> = {};
  for (const [key, value] of Object.entries(elements)) {
    if (key === id) continue;
    next[key] = value;
  }

  next[target.parentId] = { ...parent, childIds: newParentChildIds };

  for (const childId of target.childIds) {
    const child = elements[childId];
    if (!child) continue;
    let nextX = child.x;
    let nextY = child.y;
    if (parentIsFlex) {
      // Children become flex items of the grandparent — flex layout owns
      // their position so x/y is meaningless. Reset to 0 for cleanliness.
      nextX = 0;
      nextY = 0;
    } else if (targetIsFlex) {
      // Children were flex items inside the (now-removed) group, so their
      // stored x/y is 0. Position them at the group's location so they
      // appear where the group was.
      nextX = target.x;
      nextY = target.y;
    } else {
      // Both non-flex: child's x/y was relative to the group; translate
      // to be relative to the grandparent.
      nextX = target.x + child.x;
      nextY = target.y + child.y;
    }
    next[childId] = { ...child, parentId: target.parentId, x: nextX, y: nextY };
  }

  return { elements: next, promotedIds: [...target.childIds] };
};

/**
 * Deep-clone an element and all of its descendants, assigning fresh IDs
 * across the whole subtree. Returns the new root id and a map of just the
 * cloned elements (NOT merged with the original tree) so the caller can
 * splice them into the canvas state in one update.
 *
 * Pure: takes a `randomId` factory rather than calling `generateElementId`
 * directly so tests can supply a deterministic sequence.
 */
export const cloneElementSubtree = (
  elements: Record<string, ScampElement>,
  rootCloneId: string,
  newParentId: string | null,
  existingIds: ReadonlySet<string>,
  randomId: () => string = generateElementId
): { newId: string; cloned: Record<string, ScampElement> } | null => {
  const original = elements[rootCloneId];
  if (!original) return null;

  const cloned: Record<string, ScampElement> = {};
  const taken = new Set(existingIds);

  const freshId = (): string => {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = randomId();
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
    // Random space exhausted (extremely unlikely): fall back to a
    // deterministic suffix so we never return a colliding id.
    let i = 0;
    while (taken.has(`d${i}`)) i += 1;
    const fallback = `d${i}`;
    taken.add(fallback);
    return fallback;
  };

  const visit = (oldId: string, parentId: string | null): string | null => {
    const old = elements[oldId];
    if (!old) return null;
    const newId = freshId();
    const childIds: string[] = [];
    for (const childId of old.childIds) {
      const newChildId = visit(childId, newId);
      if (newChildId) childIds.push(newChildId);
    }
    cloned[newId] = {
      ...old,
      id: newId,
      parentId,
      childIds,
      // Defensive copies of nested mutable values.
      customProperties: { ...old.customProperties },
      padding: [old.padding[0], old.padding[1], old.padding[2], old.padding[3]],
      margin: [old.margin[0], old.margin[1], old.margin[2], old.margin[3]],
      borderRadius: [old.borderRadius[0], old.borderRadius[1], old.borderRadius[2], old.borderRadius[3]],
      borderWidth: [old.borderWidth[0], old.borderWidth[1], old.borderWidth[2], old.borderWidth[3]],
      // Clear the name on clones so the duplicate gets a fresh default
      // class name. The user can rename it from the layers panel.
      name: undefined,
    };
    return newId;
  };

  const newId = visit(rootCloneId, newParentId);
  if (!newId) return null;
  return { newId, cloned };
};
