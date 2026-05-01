import { type BreakpointOverride, type ElementAnimation, type ElementStateName, type KeyframesBlock, type ScampElement } from '@lib/element';
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
export type PageSource = {
    tsx: string;
    css: string;
};
export type BottomPanel = 'code' | 'terminal' | 'none';
/**
 * Properties panel display mode. `'ui'` shows typed form controls grouped
 * by section; `'css'` shows the raw CSS editor. Both modes read the same
 * underlying element state, so flipping between them is lossless.
 *
 * Stored on the canvas store (not persisted to disk) so the user's choice
 * survives selection changes during a session.
 */
export type PanelMode = 'ui' | 'css';
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
     * `@media` blocks the parser couldn't route to a known breakpoint
     * (min-width, prefers-color-scheme, custom max-widths…). Kept in
     * the store so `generateCode` can re-emit them untouched on every
     * write. Replaced whole-hog on page load / external edit.
     */
    pageCustomMediaBlocks: ReadonlyArray<string>;
    /**
     * `@keyframes` blocks for the current page. Multiple elements can
     * reference the same keyframe name; the list lives at page level
     * for that reason. `setAnimation` registers a canonical preset
     * body when an element first applies a preset that isn't already
     * in the list. Replaced whole-hog on page load / external edit.
     */
    pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>;
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
    /** Move an element to a new parent / index. Cycle-protected. */
    reorderElement: (elementId: string, newParentId: string, newIndex: number) => void;
    setEditingElement: (id: string | null) => void;
    setElementText: (id: string, text: string) => void;
    moveElement: (id: string, x: number, y: number) => void;
    resizeElement: (id: string, x: number, y: number, width: number, height: number) => void;
    patchElement: (id: string, patch: Partial<ScampElement>) => void;
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
    loadPage: (page: ActivePage, elements: Record<string, ScampElement>, source: PageSource, customMediaBlocks?: ReadonlyArray<string>, keyframesBlocks?: ReadonlyArray<KeyframesBlock>) => void;
    reloadElements: (elements: Record<string, ScampElement>, source: PageSource, customMediaBlocks?: ReadonlyArray<string>, keyframesBlocks?: ReadonlyArray<KeyframesBlock>) => void;
    setPageSource: (source: PageSource) => void;
    setBottomPanel: (panel: BottomPanel) => void;
    setPanelMode: (mode: PanelMode) => void;
    setActiveBreakpoint: (id: string) => void;
    setActiveState: (state: ElementStateName | null) => void;
    setBreakpoints: (breakpoints: Breakpoint[]) => void;
    setProjectFormat: (format: ProjectFormat) => void;
    setProjectPath: (path: string) => void;
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
export declare const useCanvasStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<CanvasState>, "temporal"> & {
    temporal: import("zustand").StoreApi<import("zundo").TemporalState<{
        elements: Record<string, ScampElement>;
    }>>;
}>;
/**
 * Extract all color values used across every element in the current page.
 * Deduplicated and sorted by frequency (most used first). Returns an empty
 * array when no meaningful colors are found.
 */
export declare const selectProjectColors: (state: CanvasState) => string[];
export {};
