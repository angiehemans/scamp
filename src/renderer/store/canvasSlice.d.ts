import { type BreakpointOverride, type ElementAnimation, type ElementStateName, type KeyframesBlock, type PropertyGroup, type ScampElement } from '@lib/element';
import { type Breakpoint, type ProjectFormat, type ThemeToken } from '@shared/types';
export type Tool = 'select' | 'rectangle' | 'text' | 'image' | 'input';
export type NewRectInput = {
    parentId: string;
    x: number;
    y: number;
    width: number;
    height: number;
};
export type NewTextInput = {
    parentId: string;
    x: number;
    y: number;
    text?: string;
};
/**
 * Input shape for placing a component instance on the active
 * page. `componentName` is the PascalCase name resolved from the
 * sidebar drag source. Position is in canvas-local coordinates;
 * sizing falls through to `auto` because the rendered component
 * defines its own dimensions.
 */
export type NewComponentInstanceInput = {
    parentId: string;
    componentName: string;
    x: number;
    y: number;
};
export type NewImageInput = {
    parentId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    src: string;
    alt?: string;
};
export type NewInputInput = {
    parentId: string;
    x: number;
    y: number;
    width: number;
    height: number;
};
export type ActivePage = {
    name: string;
    tsxPath: string;
    cssPath: string;
};
/**
 * The currently-open component definition, when the canvas is in
 * the component editor (Phase 2 of the components feature).
 * Structurally identical to `ActivePage` but kept as a separate
 * type so call sites can document which kind of artifact they're
 * editing. The invariant is that AT MOST ONE of `activePage` /
 * `activeComponent` is non-null at any time — loadPage clears
 * activeComponent and loadComponent clears activePage.
 */
export type ActiveComponent = {
    name: string;
    tsxPath: string;
    cssPath: string;
};
/**
 * A parsed component's element tree, cached on the canvas store
 * so the renderer can render instance subtrees on pages without
 * re-parsing every frame. One entry per component; the map lives
 * at `canvasStore.componentTrees`, keyed by PascalCase
 * component name.
 *
 * `elements` follows the same flat-map shape as the page's
 * `elements` field — keyed by short canvas id, rooted at
 * `rootId`. Renderers walk it the same way they walk the page's
 * own element map.
 */
export type ComponentTree = {
    elements: Record<string, ScampElement>;
    rootId: string;
};
export type PageSource = {
    tsx: string;
    css: string;
};
export type BottomPanel = 'code' | 'terminal' | 'none';
/**
 * Which tab is active in the left sidebar. `'layers'` shows the
 * existing Pages + Layers stack (the default); `'history'` shows
 * the per-page visual history panel. Per-session preference —
 * not persisted to disk.
 */
export type LeftSidebarTab = 'layers' | 'history';
/** Properties panel display mode. 'data' is component-scoped. */
export type PanelMode = 'ui' | 'css' | 'data';
/**
 * Discrete zoom levels for the canvas. Pressing Cmd/Ctrl+= and Cmd/Ctrl+-
 * walks through this list. Cmd/Ctrl+0 clears the explicit zoom and falls
 * back to "fit-to-container".
 */
export declare const ZOOM_STEPS: ReadonlyArray<number>;
type CanvasState = {
    elements: Record<string, ScampElement>;
    rootElementId: string;
    /**
     * The currently selected elements, in selection order. The first entry
     * is the "primary" selection that the properties panel and resize
     * handles use; additional entries come from shift-clicking. Empty when
     * nothing is selected.
     */
    selectedElementIds: string[];
    editingElementId: string | null;
    activeTool: Tool;
    activePage: ActivePage | null;
    /**
     * Active component sync — set when the canvas has entered the
     * component editor. Mutually exclusive with `activePage`: setting
     * one clears the other (see `loadPage` / `loadComponent`).
     * The sync bridge reads whichever is non-null to decide which
     * file pair to write back to.
     */
    activeComponent: ActiveComponent | null;
    pageSource: PageSource | null;
    isLoading: boolean;
    /**
     * The source of the most recent load. `'initial'` for the project-
     * open / page-switch path (sync bridge may rewrite the file in
     * canonical format to migrate legacy data). `'external'` for
     * chokidar-triggered loads from agent / hand edits — sync bridge
     * MUST NOT rewrite the file in this case, otherwise the agent's
     * formatting / declaration order / preserved customProperties
     * would get clobbered. Cleared back to `null` once the load
     * settles.
     */
    lastLoadKind: 'initial' | 'external' | null;
    bottomPanel: BottomPanel;
    panelMode: PanelMode;
    leftSidebarTab: LeftSidebarTab;
    /**
     * Manual canvas zoom. `null` means "auto fit to container width" — the
     * Viewport falls back to the auto-fit calculation. A number is treated
     * as the literal scale (1 === 100%).
     */
    userZoom: number | null;
    /**
     * The breakpoint the user is currently editing. `'desktop'` means
     * edits land on the element's base (top-level) style fields. Any
     * other id means edits land in `element.breakpointOverrides[id]`
     * and the canvas renders with the cascaded styles at that
     * breakpoint. Transient UI state — not persisted.
     */
    activeBreakpointId: string;
    /**
     * The pseudo-class state the user is currently editing. `null` is
     * the default (rest) state — edits land on the element's base
     * style fields. A non-null value means edits land in
     * `element.stateOverrides[activeStateName]` and the canvas
     * preview renders selected elements with that state's overrides
     * layered on. Transient UI state — not persisted to disk.
     *
     * State × non-desktop breakpoint combinations aren't supported
     * yet — the panel disables non-default states when a non-desktop
     * breakpoint is active.
     */
    activeStateName: ElementStateName | null;
    /**
     * Persisted-across-the-session export-panel settings. The Export
     * section lives at the bottom of the WYSIWYG panel and remembers
     * the user's last format / scale choice so successive exports
     * don't require re-picking. Lost on app close — there's no
     * file-backed persistence.
     */
    exportSettings: {
        lastFormat: 'png' | 'svg';
        lastPngScale: 1 | 2 | 3;
    };
    /**
     * Per-element list of CSS property names that appeared more than
     * once in the element's base class block on the most recent parse.
     * Empty / absent entries mean "no duplicates seen". The properties
     * panel reads this to surface a warning indicator on sections that
     * own the affected fields.
     *
     * The cleanup path is implicit: any panel edit on the affected
     * element triggers `generateCode` which rewrites the class block
     * from typed state, collapsing duplicates. This map is then
     * recomputed on the next parse round-trip and clears.
     */
    cssDuplicates: Record<string, ReadonlyArray<string>>;
    /**
     * Mirror of `ProjectConfig.breakpoints` — kept in the store so
     * deeply-nested components (ElementRenderer) can read the table
     * without prop-drilling. Synced by `ProjectShell` on project load
     * and whenever the config changes.
     */
    breakpoints: Breakpoint[];
    /**
     * Mirror of `ProjectData.format` — read by the sync bridge to
     * decide which CSS-module import basename `generateCode` should
     * emit (`page` for nextjs vs `<pageName>` for legacy). Synced by
     * `ProjectShell` on project load.
     */
    projectFormat: ProjectFormat;
    /**
     * Mirror of `ProjectData.path` — used by deeply-nested components
     * (image picker, asset URL resolver) that would otherwise have to
     * derive it by walking up from `activePage.tsxPath`, which only
     * works for the legacy flat layout. Empty string when no project
     * is loaded.
     */
    projectPath: string;
    /**
     * Mirror of every page name in the project (e.g. `['home', 'about',
     * 'dashboard']`). Surfaced for the Link section's destination
     * dropdown and the canvas link indicator's broken-link check —
     * deeply-nested components shouldn't have to thread `ProjectData`
     * through props. Synced by `ProjectShell` whenever the project
     * data changes (open, page add/delete/rename).
     */
    pageNames: ReadonlyArray<string>;
    /**
     * One-shot navigation request set by the canvas link indicator
     * when the user clicks an internal link. ProjectShell observes this,
     * switches the active page via its own state, and clears the field
     * back to null. Null when no request is pending.
     *
     * Lives in the store rather than as a callback so deeply-nested
     * canvas components (LinkIndicators) don't need a prop-drilled
     * navigate handler.
     */
    pendingPageNavigation: string | null;
    /**
     * One-shot request to open a component in the component editor.
     * The canvas's component-instance double-click handler sets this;
     * `ProjectShell` consumes it via an effect (same shape as the
     * page-navigation flow above), routes through its
     * `openComponent` and clears the field.
     */
    pendingComponentNavigation: string | null;
    /**
     * `@media` blocks the parser couldn't route to a known breakpoint
     * (min-width, prefers-color-scheme, custom max-widths…). Kept in
     * the store so `generateCode` can re-emit them untouched on every
     * write. Replaced whole-hog on page load / external edit.
     */
    pageCustomMediaBlocks: ReadonlyArray<string>;
    /**
     * Canvas-frame minimum height in logical pixels. The page
     * editor sets this to the `EMPTY_FRAME_MIN_HEIGHT` constant
     * (900px today) so blank pages have a visible canvas to draw
     * on; the component editor sets it to the user-configured
     * `componentCanvas[name].height` so the canvas reflects the
     * component's design bounds. Both the Viewport's frame AND
     * the root element's `min-height` style read from here, which
     * keeps them in sync so the root fills the visible canvas
     * (and clicks on empty canvas area still hit the root).
     */
    canvasMinHeight: number;
    /**
     * `@keyframes` blocks for the current page. Multiple elements can
     * reference the same keyframe name; the list lives at page level
     * for that reason. `setAnimation` registers a canonical preset
     * body when an element first applies a preset that isn't already
     * in the list. Replaced whole-hog on page load / external edit.
     */
    pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>;
    /**
     * Parsed element trees for every component definition in the
     * project. The renderer uses this to render the subtree inside
     * a `component-instance` element on the page. Keyed by
     * PascalCase component name. Empty when the project has no
     * components.
     *
     * Populated by `ProjectShell` after every change to
     * `project.components` (project open, component create / edit /
     * delete). Live updates here propagate to every instance on
     * every page without any per-page work — the renderer reads
     * from this map at render time.
     */
    componentTrees: Record<string, ComponentTree>;
    /**
     * One-shot canvas animation preview. When non-null, the matching
     * element re-renders with `key={key}` so React forces a remount
     * and the animation plays from the top. Cleared after the play
     * starts so the same Play button can re-trigger.
     */
    previewAnimation: {
        elementId: string;
        key: number;
    } | null;
    /** Design tokens parsed from the project's theme.css file. */
    themeTokens: ThemeToken[];
    /** Internal clipboard for copy/paste. Stores a snapshot of an element
     *  subtree at copy time, not a live reference. */
    clipboard: {
        elements: Record<string, ScampElement>;
        rootId: string;
    } | null;
    setTool: (tool: Tool) => void;
    /** Replace the selection with a single element (or clear it). */
    selectElement: (id: string | null) => void;
    /** Toggle an element's membership in the current selection. */
    toggleSelectElement: (id: string) => void;
    createRectangle: (input: NewRectInput) => string;
    createText: (input: NewTextInput) => string;
    createImage: (input: NewImageInput) => string;
    createInput: (input: NewInputInput) => string;
    /**
     * Insert a component instance into the active page's element
     * tree. Used by the sidebar drag-to-place flow. Returns the
     * new element's canvas id (also reused as the hex part of the
     * `data-scamp-instance-id`). No-op return when the parent is
     * missing.
     */
    insertComponentInstance: (input: NewComponentInstanceInput) => string | null;
    /**
     * Replace an element-subtree on the active page with a
     * component-instance pointing at `componentName`. Used by the
     * "Create component" convert flow after the component files
     * are written to disk: the subtree's elements are removed
     * from the page, a new instance element is spliced into the
     * subtree root's position in its parent's `childIds`, and
     * `componentName` is recorded as the instance's reference.
     * Returns the new instance's canvas id, or null when the
     * subtree root doesn't exist or is the page root (which can't
     * be replaced).
     */
    replaceSubtreeWithInstance: (subtreeRootId: string, componentName: string) => string | null;
    /** One-way detach: clone tree, bake propOverrides, drop the instance. */
    detachInstance: (instanceId: string) => string | null;
    /** Rewrite componentName on every matching instance in the active map. */
    renameComponentReferences: (oldName: string, newName: string) => void;
    duplicateElement: (id: string) => string | null;
    /** Snapshot the selected element subtree into the internal clipboard. */
    copyElement: (id: string) => void;
    /** Clone from the clipboard and insert at the current selection point. */
    pasteElement: () => string | null;
    deleteElement: (id: string) => void;
    /** Wrap the given sibling ids in a new flex group. Returns the new id or null. */
    groupElements: (ids: string[]) => string | null;
    /** Promote the children of `id` to its grandparent and remove `id`. */
    ungroupElement: (id: string) => void;
    /**
     * Wrap a single element in a new `<a>` parent carrying the given href
     * (and optional `target` / `rel` for new-tab links). Used by the
     * Link section's "Wrap in <a>" affordance for elements where
     * tag-swapping isn't appropriate (`<img>`, semantic block tags).
     *
     * Selects the wrapper after the operation so the panel reflects the
     * just-created link without the user having to click into it. Returns
     * the wrapper's id or null when the wrap isn't valid (root, missing
     * element).
     */
    wrapInLinkParent: (elementId: string, href: string, options?: {
        target?: string;
        rel?: string;
    }) => string | null;
    /** Move an element to a new parent / index. Cycle-protected. */
    reorderElement: (elementId: string, newParentId: string, newIndex: number) => void;
    setEditingElement: (id: string | null) => void;
    /** Inline contentEditable target for an instance's prop-text. see docs/notes/components-data-model.md */
    editingInstanceProp: {
        instanceId: string;
        propName: string;
    } | null;
    setEditingInstanceProp: (value: {
        instanceId: string;
        propName: string;
    } | null) => void;
    /** Write an instance prop override. Empty string is explicit, not absence. */
    setPropOverride: (instanceId: string, propName: string, value: string) => void;
    /** Drop an instance prop override → revert to component default. */
    clearPropOverride: (instanceId: string, propName: string) => void;
    setElementText: (id: string, text: string) => void;
    /** Flip text between locked literal and prop. Auto-assigns prop1/prop2/… on Locked→Prop. */
    togglePropOnText: (id: string) => void;
    /** Rename a text element's `prop`. Caller validates identifier + uniqueness. */
    renamePropOnText: (id: string, nextName: string) => void;
    moveElement: (id: string, x: number, y: number) => void;
    resizeElement: (id: string, x: number, y: number, width: number, height: number) => void;
    patchElement: (id: string, patch: Partial<ScampElement>) => void;
    /**
     * Merge `patch` into an element's `customProperties` and write the
     * result through `patchElement` (so axis routing + history apply). A
     * key whose patch value is `undefined` is DELETED — this is the
     * single safe path for add / update / remove of custom props,
     * replacing the manual splat-and-delete in section handlers where a
     * forgotten delete left stale CSS. The merge base is the resolved
     * element (active breakpoint + state), matching how panels read
     * values.
     */
    patchCustomProperties: (id: string, patch: Record<string, string | undefined>) => void;
    /**
     * Clear one or more fields from a specific breakpoint's override.
     * Used by the panel's "reset override" affordance. When the override
     * becomes empty after the clear, the whole breakpoint key is
     * deleted from the element so round-trips stay text-stable.
     * No-op when `breakpointId === 'desktop'` — base fields aren't
     * overrides and don't get reset this way.
     */
    resetElementFieldsAtBreakpoint: (id: string, breakpointId: string, fields: ReadonlyArray<keyof BreakpointOverride>) => void;
    /**
     * Clear specific fields from an element's `stateOverrides[stateName]`,
     * effectively reverting them to the base ("rest") state. Symmetric
     * with `resetElementFieldsAtBreakpoint`. When the override becomes
     * empty after the clear, the state key is deleted; when no states
     * remain, the whole `stateOverrides` field is dropped from the
     * element so round-trips stay text-stable.
     */
    resetElementFieldsAtState: (id: string, stateName: ElementStateName, fields: ReadonlyArray<keyof BreakpointOverride>) => void;
    loadPage: (page: ActivePage, elements: Record<string, ScampElement>, source: PageSource, customMediaBlocks?: ReadonlyArray<string>, keyframesBlocks?: ReadonlyArray<KeyframesBlock>, cssDuplicates?: Record<string, ReadonlyArray<string>>) => void;
    /**
     * Switch the canvas into the component editor. Same signature
     * shape as `loadPage` — the difference is the target type and
     * the syncBridge's write-path resolution (component file pair,
     * not page file pair). `activeComponent` becomes set, and
     * `activePage` is cleared.
     */
    loadComponent: (component: ActiveComponent, elements: Record<string, ScampElement>, source: PageSource, customMediaBlocks?: ReadonlyArray<string>, keyframesBlocks?: ReadonlyArray<KeyframesBlock>, cssDuplicates?: Record<string, ReadonlyArray<string>>) => void;
    reloadElements: (elements: Record<string, ScampElement>, source: PageSource, customMediaBlocks?: ReadonlyArray<string>, keyframesBlocks?: ReadonlyArray<KeyframesBlock>, cssDuplicates?: Record<string, ReadonlyArray<string>>) => void;
    setPageSource: (source: PageSource) => void;
    setBottomPanel: (panel: BottomPanel) => void;
    setPanelMode: (mode: PanelMode) => void;
    setLeftSidebarTab: (tab: LeftSidebarTab) => void;
    setActiveBreakpoint: (id: string) => void;
    setActiveState: (state: ElementStateName | null) => void;
    setExportFormat: (format: 'png' | 'svg') => void;
    setExportPngScale: (scale: 1 | 2 | 3) => void;
    setBreakpoints: (breakpoints: Breakpoint[]) => void;
    setProjectFormat: (format: ProjectFormat) => void;
    setProjectPath: (path: string) => void;
    setPageNames: (pageNames: ReadonlyArray<string>) => void;
    /**
     * Replace the cached component-tree map. Called by `ProjectShell`
     * after every change to `project.components` so every instance
     * on every page picks up the new content on the next render.
     * Pass an empty `{}` to clear (e.g. when closing the project).
     */
    setComponentTrees: (trees: Record<string, ComponentTree>) => void;
    /** Update the canvas-frame minimum height in logical pixels. */
    setCanvasMinHeight: (value: number) => void;
    /** Set / clear the pending page-navigation request. */
    requestPageNavigation: (pageName: string | null) => void;
    /** Set / clear the pending component-navigation request. */
    requestComponentNavigation: (componentName: string | null) => void;
    /**
     * Apply an animation to an element. Routes through
     * `applyPatchWithAxisRouting` so the animation lands on the
     * element's base when the default state is active and on the
     * matching state override otherwise. Also ensures a `KeyframesBlock`
     * exists in `pageKeyframesBlocks` for the animation's name —
     * appends the canonical preset body if missing, leaves any
     * existing block alone (preserves agent edits).
     */
    setAnimation: (elementId: string, animation: ElementAnimation) => void;
    /**
     * Clear the animation on an element. Same axis-routing rules as
     * `setAnimation`: removes from `element.animation` when default
     * state is active, removes from `stateOverrides[state].animation`
     * otherwise. Does NOT remove the `@keyframes` block from the
     * page — see plan: keyframes cleanup is an explicit action, not
     * an automatic side effect.
     */
    removeAnimation: (elementId: string) => void;
    /**
     * Toggle a CSS-property group OFF or ON for an element. When
     * OFF, the canvas renders as if the group's typed fields
     * weren't set, and `generateCode` emits them as a labelled
     * comment block. The typed values are preserved — toggling
     * back ON restores them. Element-scoped: applies across all
     * per-state and per-breakpoint overrides.
     */
    togglePropertyGroup: (elementId: string, group: PropertyGroup, on: boolean) => void;
    /**
     * Trigger a one-shot canvas preview of the element's animation.
     * Renders with a fresh React `key` so the animation plays from
     * the top regardless of its current run state.
     */
    playAnimation: (elementId: string) => void;
    /** Walk one step up the discrete zoom ladder. */
    zoomIn: () => void;
    /** Walk one step down the discrete zoom ladder. */
    zoomOut: () => void;
    /** Drop the manual zoom and return to fit-to-container. */
    resetZoom: () => void;
    /** Set the manual zoom to an explicit scale (or null to fit). */
    setZoom: (zoom: number | null) => void;
    setThemeTokens: (tokens: ThemeToken[]) => void;
    /** Callback to open the theme panel. Set by ProjectShell on mount. */
    openThemePanel: (() => void) | null;
    setOpenThemePanel: (fn: (() => void) | null) => void;
    resetForNewPage: () => void;
};
export declare const useCanvasStore: import("zustand").UseBoundStore<import("zustand").StoreApi<CanvasState>>;
/**
 * Extract all color values used across every element in the current page.
 * Deduplicated and sorted by frequency (most used first). Returns an empty
 * array when no meaningful colors are found.
 */
export declare const selectProjectColors: (state: CanvasState) => string[];
export {};
