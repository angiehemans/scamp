import { create } from 'zustand';
import {
  cloneElementSubtree,
  generateElementId,
  groupSiblings,
  reorderElementPure,
  ROOT_ELEMENT_ID,
  ungroupSiblings,
  type ScampElement,
} from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';

export type Tool = 'select' | 'rectangle' | 'text';

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

  setTool: (tool: Tool) => void;
  /** Replace the selection with a single element (or clear it). */
  selectElement: (id: string | null) => void;
  /** Toggle an element's membership in the current selection. */
  toggleSelectElement: (id: string) => void;
  createRectangle: (input: NewRectInput) => string;
  createText: (input: NewTextInput) => string;
  duplicateElement: (id: string) => string | null;
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
  loadPage: (
    page: ActivePage,
    elements: Record<string, ScampElement>,
    source: PageSource
  ) => void;
  reloadElements: (elements: Record<string, ScampElement>, source: PageSource) => void;
  setPageSource: (source: PageSource) => void;
  setBottomPanel: (panel: BottomPanel) => void;
  setPanelMode: (mode: PanelMode) => void;
  /** Walk one step up the discrete zoom ladder. */
  zoomIn: () => void;
  /** Walk one step down the discrete zoom ladder. */
  zoomOut: () => void;
  /** Drop the manual zoom and return to fit-to-container. */
  resetZoom: () => void;
  /** Set the manual zoom to an explicit scale (or null to fit). */
  setZoom: (zoom: number | null) => void;
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
  fontSize: 14,
  fontWeight: 400,
  color: '#222222',
  textAlign: 'left',
});

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

export const useCanvasStore = create<CanvasState>((set) => ({
  elements: { [ROOT_ELEMENT_ID]: makeRootElement() },
  rootElementId: ROOT_ELEMENT_ID,
  selectedElementIds: [],
  editingElementId: null,
  activeTool: 'select',
  activePage: null,
  pageSource: null,
  isLoading: false,
  bottomPanel: 'none',
  panelMode: 'ui',
  userZoom: null,

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
      const newRect = makeRectangle(input, id);
      return {
        elements: {
          ...state.elements,
          [id]: newRect,
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
      const newText = makeText(input, id);
      return {
        elements: {
          ...state.elements,
          [id]: newText,
          [input.parentId]: { ...parent, childIds: [...parent.childIds, id] },
        },
        selectedElementIds: [id],
        editingElementId: id,
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
      // their position so x/y is meaningless. Clamp to parent bounds so
      // the duplicate doesn't escape the canvas.
      const cloneRoot = result.cloned[result.newId]!;
      const offset = isFlexChild ? 0 : 20;
      const maxX = Math.max(0, parent.widthValue - cloneRoot.widthValue);
      const maxY = Math.max(0, parent.heightValue - cloneRoot.heightValue);
      const updatedClone = isFlexChild
        ? cloneRoot
        : {
            ...cloneRoot,
            x: Math.min(maxX, cloneRoot.x + offset),
            y: Math.min(maxY, cloneRoot.y + offset),
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
      return {
        elements: { ...state.elements, [id]: { ...el, x, y } },
      };
    }),

  resizeElement: (id, x, y, width, height) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      // Dragging a handle is an explicit "I want this size" gesture, so
      // we always switch to fixed mode — otherwise resizing a stretched
      // or fit-content element would silently store a value that the
      // generator wouldn't emit.
      return {
        elements: {
          ...state.elements,
          [id]: {
            ...el,
            x,
            y,
            widthValue: width,
            heightValue: height,
            widthMode: 'fixed',
            heightMode: 'fixed',
          },
        },
      };
    }),

  patchElement: (id, patch) =>
    set((state) => {
      const el = state.elements[id];
      if (!el) return state;
      return {
        elements: { ...state.elements, [id]: { ...el, ...patch } },
      };
    }),

  loadPage: (page, elements, source) =>
    set({
      activePage: page,
      elements,
      pageSource: source,
      selectedElementIds: [],
      isLoading: true,
    }),

  reloadElements: (elements, source) =>
    set((state) => ({
      elements,
      pageSource: source,
      // Drop any selection that no longer exists in the new tree (the file
      // could have been edited externally to remove an element).
      selectedElementIds: state.selectedElementIds.filter((id) => id in elements),
      isLoading: true,
    })),

  setPageSource: (source) => set({ pageSource: source }),

  setBottomPanel: (panel) => set({ bottomPanel: panel }),

  setPanelMode: (mode) => set({ panelMode: mode }),

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
}));
