import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  cloneElementSubtree,
  generateElementId,
  groupSiblings,
  reorderElementPure,
  ROOT_ELEMENT_ID,
  ungroupSiblings,
  type BreakpointOverride,
  type ScampElement,
} from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import {
  DEFAULT_BREAKPOINTS,
  type Breakpoint,
  type ProjectFormat,
  type ThemeToken,
} from '@shared/types';

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
export const ZOOM_STEPS: ReadonlyArray<number> = [
  0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4,
];

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

  // The element currently in text-edit mode (contentEditable). Null when
  // nothing is being edited. Only ever a text element id.
  editingElementId: string | null;
  activeTool: Tool;

  // Active page sync — set when a page is loaded; null between project open
  // and first page selection.
  activePage: ActivePage | null;

  // The current on-disk content of the active page. Updated by the sync
  // bridge whenever the canvas writes to disk OR an external edit comes
  // in. Read by the bottom code panel so it always reflects the file.
  pageSource: PageSource | null;

  // Set true while applying state from a parseCode result (external file
  // change or initial page load). Subscribers that auto-write should bail
  // when this is true so we don't echo a load straight back to disk.
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

  // UI: which bottom panel is open. M5 will add 'terminal'.
  bottomPanel: BottomPanel;

  // UI: which view of the properties panel is active. See `PanelMode`.
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
  resetElementFieldsAtBreakpoint: (
    id: string,
    breakpointId: string,
    fields: ReadonlyArray<keyof BreakpointOverride>
  ) => void;
  loadPage: (
    page: ActivePage,
    elements: Record<string, ScampElement>,
    source: PageSource,
    customMediaBlocks?: ReadonlyArray<string>
  ) => void;
  reloadElements: (
    elements: Record<string, ScampElement>,
    source: PageSource,
    customMediaBlocks?: ReadonlyArray<string>
  ) => void;
  setPageSource: (source: PageSource) => void;
  setBottomPanel: (panel: BottomPanel) => void;
  setPanelMode: (mode: PanelMode) => void;
  setActiveBreakpoint: (id: string) => void;
  setBreakpoints: (breakpoints: Breakpoint[]) => void;
  setProjectFormat: (format: ProjectFormat) => void;
  setProjectPath: (path: string) => void;
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

const makeRootElement = (): ScampElement => ({
  ...DEFAULT_ROOT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds: [],
  widthMode: 'fixed',
  heightMode: 'fixed',
  x: 0,
  y: 0,
  customProperties: {},
});

/**
 * Default fill color for any rectangle created via the canvas tool. We
 * deliberately override `DEFAULT_RECT_STYLES.backgroundColor` (transparent)
 * here because a transparent rect on the white page frame is invisible —
 * the user just sees their click do nothing. Light grey is visible and
 * still neutral enough that the user can recolor it from the panel.
 */
const NEW_RECT_BACKGROUND = '#e5e5e5';

const makeRectangle = (input: NewRectInput, id: string): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId: input.parentId,
  childIds: [],
  x: input.x,
  y: input.y,
  widthValue: input.width,
  heightValue: input.height,
  backgroundColor: NEW_RECT_BACKGROUND,
  customProperties: {},
});

const TEXT_DEFAULT_WIDTH = 120;
const TEXT_DEFAULT_HEIGHT = 24;

const makeText = (input: NewTextInput, id: string): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'text',
  parentId: input.parentId,
  childIds: [],
  x: input.x,
  y: input.y,
  widthValue: TEXT_DEFAULT_WIDTH,
  heightValue: TEXT_DEFAULT_HEIGHT,
  customProperties: {},
  text: input.text ?? 'Text',
  fontSize: '14px',
  fontWeight: 400,
  color: '#222222',
  textAlign: 'left',
});

const makeImage = (input: NewImageInput, id: string): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'image',
  parentId: input.parentId,
  childIds: [],
  x: input.x,
  y: input.y,
  widthValue: input.width,
  heightValue: input.height,
  customProperties: {},
  src: input.src,
  alt: input.alt ?? '',
});

/**
 * Default visual treatment for an input drawn on the canvas — a
 * subtle outlined box so the user can see what they drew. Users are
 * free to re-style from the panel.
 */
const NEW_INPUT_BACKGROUND = '#ffffff';
const NEW_INPUT_BORDER_COLOR = '#cbd5e1';

const makeInput = (input: NewInputInput, id: string): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'input',
  parentId: input.parentId,
  childIds: [],
  x: input.x,
  y: input.y,
  widthValue: input.width,
  heightValue: input.height,
  backgroundColor: NEW_INPUT_BACKGROUND,
  borderWidth: [1, 1, 1, 1],
  borderStyle: 'solid',
  borderColor: NEW_INPUT_BORDER_COLOR,
  borderRadius: [4, 4, 4, 4],
  customProperties: {},
  attributes: { type: 'text' },
});

/**
 * When a new rectangle or text element is drawn inside a `<ul>` or
 * `<ol>`, default its tag to `<li>` so the output semantic is correct
 * without the user having to open the Element section.
 */
const tagForListChildContext = (
  parent: ScampElement | undefined
): string | undefined => {
  if (!parent) return undefined;
  if (parent.tag === 'ul' || parent.tag === 'ol') return 'li';
  return undefined;
};

/**
 * Fields that are NEVER written into a breakpoint override — they're
 * identity / tree / TSX-level concepts that can't meaningfully change
 * per-breakpoint. A patch containing any of these applies them to
 * the element's top-level fields regardless of the active breakpoint.
 */
const BASE_ONLY_PATCH_FIELDS = new Set<keyof ScampElement>([
  'id',
  'type',
  'parentId',
  'childIds',
  'breakpointOverrides',
  'tag',
  'attributes',
  'selectOptions',
  'svgSource',
  'text',
  'name',
]);

/**
 * Apply a patch to an element while respecting the active breakpoint.
 * When active is desktop (or no breakpoint override applies), the
 * patch writes through to top-level fields as before. In non-desktop
 * mode, style fields route into `breakpointOverrides[activeId]` —
 * identity / content fields still go to the top level because they
 * can't be per-breakpoint in our model.
 *
 * Pure — takes the element + patch, returns the next element.
 */
const applyPatchWithBreakpointRouting = (
  el: ScampElement,
  patch: Partial<ScampElement>,
  activeBreakpointId: string
): ScampElement => {
  // Split the patch into base (always-top-level) and style (goes to
  // override when non-desktop).
  const basePatch: Partial<ScampElement> = {};
  const stylePatch: BreakpointOverride = {};
  for (const key of Object.keys(patch) as Array<keyof ScampElement>) {
    if (BASE_ONLY_PATCH_FIELDS.has(key)) {
      (basePatch as Record<string, unknown>)[key] = patch[key];
    } else {
      (stylePatch as Record<string, unknown>)[key] = patch[key];
    }
  }

  if (activeBreakpointId === 'desktop') {
    // Desktop: merge everything straight onto the element.
    return { ...el, ...basePatch, ...stylePatch };
  }

  // Non-desktop: base patch still lands on top-level (identity/content
  // fields aren't breakpoint-specific); style patch lands in the
  // override bucket for the active breakpoint.
  const mergedBase = Object.keys(basePatch).length > 0 ? { ...el, ...basePatch } : el;
  const styleKeys = Object.keys(stylePatch);
  if (styleKeys.length === 0) return mergedBase;

  const existingOverride = mergedBase.breakpointOverrides?.[activeBreakpointId] ?? {};
  // customProperties merge object-wise so a new entry doesn't wipe
  // earlier ones at the same breakpoint.
  const mergedCustom =
    'customProperties' in stylePatch && stylePatch.customProperties
      ? {
          ...(existingOverride.customProperties ?? {}),
          ...stylePatch.customProperties,
        }
      : existingOverride.customProperties;
  const nextOverride: BreakpointOverride = {
    ...existingOverride,
    ...stylePatch,
    ...(mergedCustom !== undefined ? { customProperties: mergedCustom } : {}),
  };
  return {
    ...mergedBase,
    breakpointOverrides: {
      ...mergedBase.breakpointOverrides,
      [activeBreakpointId]: nextOverride,
    },
  };
};

/** Pick a fresh element id that doesn't collide with any existing one. */
const freshId = (existing: ReadonlySet<string>): string => {
  for (let i = 0; i < 32; i += 1) {
    const candidate = generateElementId();
    if (!existing.has(candidate)) return candidate;
  }
  let i = 0;
  while (existing.has(`g${i}`)) i += 1;
  return `g${i}`;
};

export const useCanvasStore = create<CanvasState>()(temporal((set) => ({
  elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
  rootElementId: ROOT_ELEMENT_ID,
  selectedElementIds: [],
  editingElementId: null,
  activeTool: 'select',
  activePage: null,
  pageSource: null,
  isLoading: false,
  lastLoadKind: null,
  bottomPanel: 'none',
  panelMode: 'ui',
  userZoom: null,
  activeBreakpointId: 'desktop',
  breakpoints: [...DEFAULT_BREAKPOINTS],
  projectFormat: 'nextjs',
  projectPath: '',
  pageCustomMediaBlocks: [],
  themeTokens: [],
  clipboard: null,

  setTool: (tool) => set({ activeTool: tool }),

  selectElement: (id) =>
    set({ selectedElementIds: id === null ? [] : [id] }),

  toggleSelectElement: (id) =>
    set((state) => {
      const idx = state.selectedElementIds.indexOf(id);
      if (idx >= 0) {
        const next = [...state.selectedElementIds];
        next.splice(idx, 1);
        return { selectedElementIds: next };
      }
      return { selectedElementIds: [...state.selectedElementIds, id] };
    }),

  createRectangle: (input) => {
    const id = generateElementId();
    set((state) => {
      const parent = state.elements[input.parentId];
      if (!parent) return state;
      const contextTag = tagForListChildContext(parent);
      const newRect = makeRectangle(input, id);
      const withTag = contextTag ? { ...newRect, tag: contextTag } : newRect;
      return {
        elements: {
          ...state.elements,
          [id]: withTag,
          [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
        },
        selectedElementIds: [id],
      };
    });
    return id;
  },

  createText: (input) => {
    const id = generateElementId();
    set((state) => {
      const parent = state.elements[input.parentId];
      if (!parent) return state;
      const contextTag = tagForListChildContext(parent);
      const newText = makeText(input, id);
      const withTag = contextTag ? { ...newText, tag: contextTag } : newText;
      return {
        elements: {
          ...state.elements,
          [id]: withTag,
          [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
        },
        selectedElementIds: [id],
        editingElementId: id,
      };
    });
    return id;
  },

  createImage: (input) => {
    const id = generateElementId();
    set((state) => {
      const parent = state.elements[input.parentId];
      if (!parent) return state;
      const newImage = makeImage(input, id);
      return {
        elements: {
          ...state.elements,
          [id]: newImage,
          [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
        },
        selectedElementIds: [id],
      };
    });
    return id;
  },

  createInput: (input) => {
    const id = generateElementId();
    set((state) => {
      const parent = state.elements[input.parentId];
      if (!parent) return state;
      const newInput = makeInput(input, id);
      return {
        elements: {
          ...state.elements,
          [id]: newInput,
          [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
        },
        selectedElementIds: [id],
      };
    });
    return id;
  },

  deleteElement: (id) =>
    set((state) => {
      // Root is the page frame and can't be removed.
      if (id === ROOT_ELEMENT_ID) return state;
      const target = state.elements[id];
      if (!target) return state;

      // Collect this element + all descendants so we can drop them in one
      // pass. Walks childIds depth-first; safe because the canvas tree is
      // a tree (no cycles).
      const toRemove = new Set<string>();
      const visit = (visitId: string): void => {
        if (toRemove.has(visitId)) return;
        toRemove.add(visitId);
        const el = state.elements[visitId];
        if (!el) return;
        for (const childId of el.childIds) visit(childId);
      };
      visit(id);

      const nextElements: Record<string, ScampElement> = {};
      for (const [key, value] of Object.entries(state.elements)) {
        if (toRemove.has(key)) continue;
        nextElements[key] = value;
      }

      // Detach from parent's childIds.
      if (target.parentId) {
        const parent = nextElements[target.parentId];
        if (parent) {
          nextElements[target.parentId] = {
            ...parent,
            childIds: parent.childIds.filter((childId) => childId !== id),
          };
        }
      }

      return {
        elements: nextElements,
        selectedElementIds: state.selectedElementIds.filter((s) => !toRemove.has(s)),
        editingElementId:
          state.editingElementId && toRemove.has(state.editingElementId)
            ? null
            : state.editingElementId,
      };
    }),

  duplicateElement: (id) => {
    let createdId: string | null = null;
    set((state) => {
      // Root cannot be duplicated — there's only ever one page frame.
      if (id === ROOT_ELEMENT_ID) return state;
      const original = state.elements[id];
      if (!original || !original.parentId) return state;

      const result = cloneElementSubtree(
        state.elements,
        id,
        original.parentId,
        new Set(Object.keys(state.elements))
      );
      if (!result) return state;

      const parent = state.elements[original.parentId];
      if (!parent) return state;
      const isFlexChild = parent.display === 'flex';

      // Offset the top-level clone so it's visually distinct from the
      // original. Skip the offset for flex children — flex layout owns
      // their position so x/y is meaningless. Clamp to parent bounds
      // so the duplicate doesn't escape the canvas — but when the
      // parent is root, the parent's stored widthValue/heightValue is
      // stale (root defaults to stretch/auto). Skip clamping there and
      // trust the offset.
      const cloneRoot = result.cloned[result.newId]!;
      const offset = isFlexChild ? 0 : 20;
      const parentIsRoot = parent.id === ROOT_ELEMENT_ID;
      const updatedClone = isFlexChild
        ? cloneRoot
        : parentIsRoot
          ? {
              ...cloneRoot,
              x: cloneRoot.x + offset,
              y: cloneRoot.y + offset,
            }
          : {
              ...cloneRoot,
              x: Math.min(
                Math.max(0, parent.widthValue - cloneRoot.widthValue),
                cloneRoot.x + offset
              ),
              y: Math.min(
                Math.max(0, parent.heightValue - cloneRoot.heightValue),
                cloneRoot.y + offset
              ),
            };

      // Insert the clone right after the original in childIds so it
      // appears as the next sibling — important for flex layouts where
      // sibling order is the only positioning signal.
      const idx = parent.childIds.indexOf(id);
      const insertAt = idx >= 0 ? idx + 1 : parent.childIds.length;
      const newChildIds = [...parent.childIds];
      newChildIds.splice(insertAt, 0, result.newId);
      const updatedParent: ScampElement = { ...parent, childIds: newChildIds };

      createdId = result.newId;
      return {
        elements: {
          ...state.elements,
          ...result.cloned,
          [result.newId]: updatedClone,
          [updatedParent.id]: updatedParent,
        },
        selectedElementIds: [result.newId],
      };
    });
    return createdId;
  },

  copyElement: (id) => {
    set((state) => {
      if (id === ROOT_ELEMENT_ID) return state;
      const el = state.elements[id];
      if (!el) return state;

      // Deep-copy the subtree into the clipboard. Walk depth-first and
      // collect every element in the subtree keyed by its original id.
      const snapshot: Record<string, ScampElement> = {};
      const visit = (visitId: string): void => {
        const node = state.elements[visitId];
        if (!node) return;
        snapshot[visitId] = {
          ...node,
          customProperties: { ...node.customProperties },
          padding: [...node.padding] as [number, number, number, number],
          margin: [...node.margin] as [number, number, number, number],
          borderRadius: [...node.borderRadius] as [number, number, number, number],
          borderWidth: [...node.borderWidth] as [number, number, number, number],
        };
        for (const childId of node.childIds) visit(childId);
      };
      visit(id);
      return { clipboard: { elements: snapshot, rootId: id } };
    });
  },

  pasteElement: () => {
    let createdId: string | null = null;
    set((state) => {
      if (!state.clipboard) return state;

      // Paste INTO the selected element as its last child. If nothing
      // is selected, paste into the root.
      const selectedId = state.selectedElementIds[0];
      const parentId = selectedId ?? ROOT_ELEMENT_ID;
      const parent = state.elements[parentId];
      if (!parent) return state;
      const insertIdx = parent.childIds.length;

      // Clone the clipboard subtree with fresh IDs.
      const result = cloneElementSubtree(
        state.clipboard.elements,
        state.clipboard.rootId,
        parentId,
        new Set(Object.keys(state.elements))
      );
      if (!result) return state;

      const newChildIds = [...parent.childIds];
      newChildIds.splice(insertIdx, 0, result.newId);
      const updatedParent: ScampElement = { ...parent, childIds: newChildIds };

      createdId = result.newId;
      return {
        elements: {
          ...state.elements,
          ...result.cloned,
          [updatedParent.id]: updatedParent,
        },
        selectedElementIds: [result.newId],
      };
    });
    return createdId;
  },

  groupElements: (ids) => {
    let createdId: string | null = null;
    set((state) => {
      if (ids.length === 0) return state;
      const groupId = freshId(new Set(Object.keys(state.elements)));
      const result = groupSiblings(state.elements, ids, groupId);
      if (!result) return state;
      createdId = result.groupId;
      return {
        elements: result.elements,
        selectedElementIds: [result.groupId],
      };
    });
    return createdId;
  },

  ungroupElement: (id) =>
    set((state) => {
      const result = ungroupSiblings(state.elements, id);
      if (!result) return state;
      return {
        elements: result.elements,
        selectedElementIds: result.promotedIds,
      };
    }),

  reorderElement: (elementId, newParentId, newIndex) =>
    set((state) => {
      const next = reorderElementPure(state.elements, elementId, newParentId, newIndex);
      if (!next) return state;
      return { elements: next };
    }),

  setEditingElement: (id) => set({ editingElementId: id }),

  setElementText: (id, text) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      return {
        elements: { ...state.elements, [id]: { ...el, text } },
      };
    }),

  moveElement: (id, x, y) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      const next = applyPatchWithBreakpointRouting(
        el,
        { x, y },
        state.activeBreakpointId
      );
      return { elements: { ...state.elements, [id]: next } };
    }),

  resizeElement: (id, x, y, width, height) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      // Dragging a handle is an explicit "I want this size" gesture, so
      // we always switch to fixed mode — otherwise resizing a stretched
      // or fit-content element would silently store a value that the
      // generator wouldn't emit.
      const next = applyPatchWithBreakpointRouting(
        el,
        {
          x,
          y,
          widthValue: width,
          heightValue: height,
          widthMode: 'fixed',
          heightMode: 'fixed',
        },
        state.activeBreakpointId
      );
      return { elements: { ...state.elements, [id]: next } };
    }),

  patchElement: (id, patch) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      const next = applyPatchWithBreakpointRouting(
        el,
        patch,
        state.activeBreakpointId
      );
      return { elements: { ...state.elements, [id]: next } };
    }),

  resetElementFieldsAtBreakpoint: (id, breakpointId, fields) =>
    set((state) => {
      if (breakpointId === 'desktop') return state;
      const el = state.elements[id];
      if (!el || !el.breakpointOverrides) return state;
      const existing = el.breakpointOverrides[breakpointId];
      if (!existing) return state;
      const nextOverride: BreakpointOverride = { ...existing };
      for (const field of fields) {
        delete nextOverride[field];
      }
      const overrides = { ...el.breakpointOverrides };
      if (Object.keys(nextOverride).length === 0) {
        // Empty override object — drop the breakpoint key so
        // generateCode won't emit an empty @media rule.
        delete overrides[breakpointId];
      } else {
        overrides[breakpointId] = nextOverride;
      }
      // If no breakpoints have any overrides, delete the whole field
      // so round-trips stay text-stable.
      const { breakpointOverrides: _, ...elWithoutOverrides } = el;
      const nextElement: ScampElement =
        Object.keys(overrides).length === 0
          ? (elWithoutOverrides as ScampElement)
          : { ...el, breakpointOverrides: overrides };
      return {
        elements: { ...state.elements, [id]: nextElement },
      };
    }),

  loadPage: (page, elements, source, customMediaBlocks) =>
    set({
      activePage: page,
      elements,
      pageSource: source,
      pageCustomMediaBlocks: customMediaBlocks ?? [],
      selectedElementIds: [],
      isLoading: true,
      lastLoadKind: 'initial',
    }),

  reloadElements: (elements, source, customMediaBlocks) =>
    set((state) => ({
      elements,
      pageSource: source,
      pageCustomMediaBlocks: customMediaBlocks ?? state.pageCustomMediaBlocks,
      // Drop any selection that no longer exists in the new tree (the file
      // could have been edited externally to remove an element).
      selectedElementIds: state.selectedElementIds.filter((id) => id in elements),
      isLoading: true,
      lastLoadKind: 'external',
    })),

  setPageSource: (source) => set({ pageSource: source }),

  setBottomPanel: (panel) => set({ bottomPanel: panel }),

  setPanelMode: (mode) => set({ panelMode: mode }),

  setActiveBreakpoint: (id) => set({ activeBreakpointId: id }),

  setBreakpoints: (breakpoints) => set({ breakpoints }),

  setProjectFormat: (projectFormat) => set({ projectFormat }),

  setProjectPath: (projectPath) => set({ projectPath }),

  zoomIn: () =>
    set((state) => {
      // Coming from fit-mode, treat the current effective zoom as 1.0
      // (100%). The user pressed "in" — they want to grow, so anchor at
      // 100% rather than the auto-fit value (which might be < 1) so the
      // first tap reliably gets bigger.
      const current = state.userZoom ?? 1;
      const next =
        ZOOM_STEPS.find((s) => s > current + 1e-3) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
      return { userZoom: next };
    }),

  zoomOut: () =>
    set((state) => {
      const current = state.userZoom ?? 1;
      // Largest step strictly less than current; walk the list backwards.
      let next: number = ZOOM_STEPS[0]!;
      for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
        const step = ZOOM_STEPS[i]!;
        if (step < current - 1e-3) {
          next = step;
          break;
        }
      }
      return { userZoom: next };
    }),

  resetZoom: () => set({ userZoom: null }),

  setZoom: (zoom) => set({ userZoom: zoom }),

  setThemeTokens: (tokens) => set({ themeTokens: tokens }),

  openThemePanel: null,
  setOpenThemePanel: (fn) => set({ openThemePanel: fn }),

  resetForNewPage: () =>
    set({
      elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
      selectedElementIds: [],
      editingElementId: null,
      activePage: null,
      pageSource: null,
      isLoading: false,
      // Drop the manual zoom too — we want a fresh project to start in
      // fit-to-container mode regardless of the previous session.
      userZoom: null,
    }),
}), {
  // Only track element state for undo/redo — ignore UI state like
  // activeTool, selectedElementIds, bottomPanel, panelMode, etc.
  partialize: (state) => ({ elements: state.elements }),
  limit: 50,
  // Avoid recording history when the store is loading from disk
  // (page load, external file change). Those mutations call
  // set({ isLoading: true }), but partialize only sees `elements`
  // so we use the equality check to skip recording when the whole
  // elements map is replaced wholesale during a load.
  equality: (a, b) => a.elements === b.elements,
}));

// ---- Derived selectors ----

const EXCLUDED_COLORS = new Set(['transparent', 'inherit', 'initial', 'unset', 'currentColor']);

/**
 * Extract all color values used across every element in the current page.
 * Deduplicated and sorted by frequency (most used first). Returns an empty
 * array when no meaningful colors are found.
 */
export const selectProjectColors = (state: CanvasState): string[] => {
  const freq = new Map<string, number>();
  for (const el of Object.values(state.elements)) {
    const colors = [el.backgroundColor, el.borderColor, el.color].filter(
      (c): c is string => typeof c === 'string' && c.length > 0 && !EXCLUDED_COLORS.has(c)
    );
    for (const c of colors) {
      freq.set(c, (freq.get(c) ?? 0) + 1);
    }
  }
  if (freq.size === 0) return [];
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);
};
