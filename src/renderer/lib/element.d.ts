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
export type JustifyContent = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
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
export type Position = 'auto' | 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
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
export type InlineFragment = {
    kind: 'text';
    value: string;
    afterChildIndex: number;
} | {
    kind: 'jsx';
    source: string;
    afterChildIndex: number;
};
/**
 * The named easing keywords the WYSIWYG dropdown offers. The parser
 * also accepts arbitrary `cubic-bezier(...)` expressions and stores
 * them verbatim in this same field — the panel renders those as the
 * `Custom…` row.
 */
export type TransitionEasing = 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | string;
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
/**
 * The names of curated preset animations Scamp ships in its picker.
 * Stored on the element when the user selects from the picker; on
 * round-trip, names matching this list AND with a canonical
 * keyframes body are recognised back to the picker. Anything else
 * is preserved verbatim as `isPreset: false`.
 *
 * Order here matches the picker's grouping (entrances, exits,
 * attention, subtle) for predictable iteration.
 */
export type AnimationPresetName = 'fade-in' | 'fade-in-up' | 'fade-in-down' | 'slide-in-left' | 'slide-in-right' | 'scale-in' | 'bounce-in' | 'fade-out' | 'fade-out-up' | 'slide-out-left' | 'slide-out-right' | 'scale-out' | 'pulse' | 'shake' | 'bounce' | 'spin' | 'ping' | 'float' | 'wiggle';
export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';
export type AnimationPlayState = 'running' | 'paused';
/**
 * One CSS animation applied to an element. Stored as typed fields so
 * the panel can render proper controls; serialised back to the
 * `animation` shorthand on emit.
 *
 * `isPreset` records whether the name matched the preset library at
 * parse time AND whether the keyframes body matched the canonical
 * preset body — both must be true for the picker to show "Preset:
 * fade-in-up". A preset name with an agent-edited body shows as
 * "Custom (was fade-in-up)".
 *
 * `easing` is a free-form string at the data layer so that
 * agent-written easings outside the typed dropdown (`cubic-bezier(...)`,
 * `steps(...)`, etc.) round-trip cleanly.
 */
export type ElementAnimation = {
    name: string;
    isPreset: boolean;
    durationMs: number;
    easing: string;
    delayMs: number;
    iterationCount: number | 'infinite';
    direction: AnimationDirection;
    fillMode: AnimationFillMode;
    playState: AnimationPlayState;
};
/**
 * One `@keyframes` rule on a page, preserved at the page level
 * because keyframes are shared resources — multiple elements can
 * reference the same `fade-in-up` block. Mirrors the
 * `customMediaBlocks` shape: `body` is the verbatim declaration
 * list (the part between the outer braces).
 */
export type KeyframesBlock = {
    /** The keyframe name as written, e.g. `fade-in-up`. */
    name: string;
    /** Verbatim declaration block content, including all rule blocks
     *  and comments, formatted as the source had it. */
    body: string;
    /** True when `name` matches a preset AND `body` is structurally
     *  equivalent to the canonical preset body. False for
     *  agent-written, edited, or unknown-named blocks. */
    isPreset: boolean;
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
    widthMode: WidthMode;
    widthValue: number;
    heightMode: HeightMode;
    heightValue: number;
    x: number;
    y: number;
    /**
     * `position` mode. Default `'auto'` lets the generator pick based
     * on tree shape (root → relative, non-flex child → absolute, flex
     * child → none). Any other value pins the position and gets
     * emitted as-is. Useful for sticky navbars, fixed overlays, etc.
     */
    position: Position;
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
    /**
     * Optional CSS `min-height` as a free-form string (so `100vh`,
     * `500px`, `var(--page-min-h)`, `calc(...)` round-trip without a
     * parallel "raw" field). Undefined when no `min-height` is declared
     * for the element. The page-root defaults to `'100vh'` via
     * `DEFAULT_ROOT_STYLES` so generated pages have a visible height in
     * any browser; non-root elements default to undefined and only emit
     * a declaration when the user / agent sets one explicitly.
     */
    minHeight?: string;
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
     * Single CSS animation applied to this element. Undefined when
     * the element has no `animation` declaration. Multi-animation
     * source (`animation: a 1s, b 2s`) is preserved verbatim via
     * `customProperties.animation` rather than this field — the
     * panel doesn't model the multi case.
     */
    animation?: ElementAnimation;
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
export type BreakpointOverride = Partial<Omit<ScampElement, 'id' | 'type' | 'parentId' | 'childIds' | 'breakpointOverrides' | 'stateOverrides' | 'customSelectorBlocks' | 'tag' | 'attributes' | 'selectOptions' | 'svgSource' | 'text' | 'name'>>;
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
export declare const ELEMENT_STATES: ReadonlyArray<ElementStateName>;
/**
 * Subset of element fields a per-state override can carry. Strict
 * superset of `BreakpointOverride` — every breakpoint-overridable
 * field is also state-overridable, plus `animation` (which states
 * support but breakpoints don't). The asymmetry is deliberate:
 * per-state animations are common (`:hover` triggers `shake`);
 * per-breakpoint animations are rare and add UX complexity.
 *
 * The properties panel deliberately doesn't expose `position` / `x`
 * / `y` / `transitions` controls when a non-default state is active
 * (hover layout shifts are bad UX; per-state transitions are a
 * separate feature). That UI rule lives in the section components,
 * not in this type — preserving anything an agent hand-writes inside
 * a pseudo-class block is more important than blocking it at the
 * type boundary.
 *
 * Because `StateOverride` extends `BreakpointOverride`, code that
 * takes a `BreakpointOverride` (the shared override emitter, the
 * shared override parser entry point) accepts a state override too —
 * but only sees the breakpoint-overridable fields. The animation
 * branch in `breakpointOverrideLines` is therefore unreachable for
 * an actual breakpoint override per the type system; comment in
 * place to flag this for future maintainers.
 */
export type StateOverride = BreakpointOverride & {
    animation?: ElementAnimation;
};
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
export declare const ROOT_ELEMENT_ID = "root";
/**
 * Generate a 4-character lowercase hex id, matching the format used in the
 * generated CSS class names (`rect_a1b2`).
 */
export declare const generateElementId: () => string;
/**
 * Slugify a user-given element name into a valid CSS class prefix.
 * Lowercases, replaces spaces with hyphens, strips anything that isn't
 * alphanumeric or a hyphen. Returns an empty string if the result is
 * empty (caller falls back to the default type prefix).
 *
 * CSS identifiers can't start with a digit, so a leading digit gets
 * prefixed with `_`.
 */
export declare const slugifyName: (name: string) => string;
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
export declare const reorderElementPure: (elements: Record<string, ScampElement>, elementId: string, newParentId: string, newIndex: number) => Record<string, ScampElement> | null;
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
export declare const groupSiblings: (elements: Record<string, ScampElement>, ids: readonly string[], groupId: string) => {
    elements: Record<string, ScampElement>;
    groupId: string;
} | null;
/**
 * Inverse of `groupSiblings`: remove an element from the tree and promote
 * its children to take its place in its grandparent. Pure. Returns null
 * if `id` is the root, has no parent, or has no children to promote.
 *
 * If the ungrouped element was a flex container inside a non-flex parent,
 * children are translated by the group's stored (x, y) so they roughly
 * stay where the user saw them. Otherwise their x/y carry over directly.
 */
export declare const ungroupSiblings: (elements: Record<string, ScampElement>, id: string) => {
    elements: Record<string, ScampElement>;
    promotedIds: string[];
} | null;
/**
 * Deep-clone an element and all of its descendants, assigning fresh IDs
 * across the whole subtree. Returns the new root id and a map of just the
 * cloned elements (NOT merged with the original tree) so the caller can
 * splice them into the canvas state in one update.
 *
 * Pure: takes a `randomId` factory rather than calling `generateElementId`
 * directly so tests can supply a deterministic sequence.
 */
export declare const cloneElementSubtree: (elements: Record<string, ScampElement>, rootCloneId: string, newParentId: string | null, existingIds: ReadonlySet<string>, randomId?: () => string) => {
    newId: string;
    cloned: Record<string, ScampElement>;
} | null;
