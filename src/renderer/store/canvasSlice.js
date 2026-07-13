// The canvas store: in-memory element tree + all canvas/UI state for the
// active page or component. The single source of truth the sync bridge
// serialises to disk. Every mutating action that should be undoable calls
// `commitElementsToHistory`; see docs/notes/history-coverage.md for which
// do and don't.
//
// This file owns the `CanvasState` type (the full state shape) and
// assembles `useCanvasStore` from domain slice-creators via the Zustand
// slice pattern. Each slice is a `StateCreator` returning a
// `Pick<CanvasState, ...>`; spreading the Picks reconstructs the whole
// state, so the type stays in one place. The actions live in:
//   store/canvas/slices/elementsCreate.ts — create*/insert/duplicate/
//                                            group/reorder + clipboard
//   store/canvas/slices/elementsEdit.ts   — patch/move/resize/text/
//                                            overrides/animation/resets
//   store/canvas/slices/selection.ts      — selection, tool, edit mode
//   store/canvas/slices/document.ts       — load/reload page & component
//   store/canvas/slices/ui.ts             — panels, zoom, export settings
//   store/canvas/slices/designSystem.ts   — breakpoints, states, tokens
//   store/canvas/slices/project.ts        — project metadata + navigation
// Shared helpers: store/canvas/{factories,patchRouting,history}.ts.
// `selectProjectColors` wraps @lib/projectColors.
import { create } from 'zustand';
import { projectColorsFromElements } from '@lib/projectColors';
import { createElementsCreateSlice } from './canvas/slices/elementsCreate';
import { createElementsEditSlice } from './canvas/slices/elementsEdit';
import { createSelectionSlice } from './canvas/slices/selection';
import { createDocumentSlice } from './canvas/slices/document';
import { createUiSlice } from './canvas/slices/ui';
import { createDesignSystemSlice } from './canvas/slices/designSystem';
import { createProjectSlice } from './canvas/slices/project';
export { MIN_ZOOM, MAX_ZOOM } from '@lib/zoom';
export const useCanvasStore = create()((...a) => ({
    ...createElementsCreateSlice(...a),
    ...createElementsEditSlice(...a),
    ...createSelectionSlice(...a),
    ...createDocumentSlice(...a),
    ...createUiSlice(...a),
    ...createDesignSystemSlice(...a),
    ...createProjectSlice(...a),
}));
// ---- Derived selectors ----
/**
 * Project palette — colors used across the current page, most-frequent
 * first. Extraction logic lives in @lib/projectColors; this selector
 * wraps it for useCanvasStore(selectProjectColors).
 */
export const selectProjectColors = (state) => projectColorsFromElements(state.elements);
/**
 * The scale the canvas is actually rendered at: explicit user zoom when
 * set, otherwise the last-measured auto-fit scale. Single source both the
 * zoom indicator and the wheel handler anchor on.
 */
export const selectEffectiveScale = (state) => state.userZoom ?? state.fitScale;
/**
 * Whether an element's aspect-ratio lock is currently in effect. True only
 * when a lock entry exists AND both axes are `fixed` — so the lock stops
 * having an effect the moment an axis leaves fixed, even if a stale entry
 * lingers (belt-and-suspenders with `clearRatioLock`). `null` id → false.
 */
export const selectIsRatioLocked = (state, id) => {
    if (!id || state.ratioLocks[id] === undefined)
        return false;
    const el = state.elements[id];
    return el?.widthMode === 'fixed' && el?.heightMode === 'fixed';
};
