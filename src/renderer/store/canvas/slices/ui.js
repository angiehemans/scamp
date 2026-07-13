import { applyPatchWithAxisRouting, } from '../patchRouting';
import { commitElementsToHistory } from '../history';
import { stepZoom } from '@lib/zoom';
import { useCanvasStore, } from '../../canvasSlice';
export const createUiSlice = (set) => ({
    bottomPanel: 'none',
    panelMode: 'ui',
    leftSidebarTab: 'layers',
    userZoom: null,
    fitScale: 1,
    ratioLocks: {},
    exportSettings: { lastFormat: 'png', lastPngScale: 2 },
    // Default matches the page-editor canvas. ProjectShell
    // overrides this when entering the component editor so the
    // canvas reflects the per-component height.
    canvasMinHeight: 900,
    setBottomPanel: (panel) => set({ bottomPanel: panel }),
    setPanelMode: (mode) => set({ panelMode: mode }),
    setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),
    setExportFormat: (format) => set((state) => ({
        exportSettings: { ...state.exportSettings, lastFormat: format },
    })),
    setExportPngScale: (scale) => set((state) => ({
        exportSettings: { ...state.exportSettings, lastPngScale: scale },
    })),
    setCanvasMinHeight: (value) => set({ canvasMinHeight: value }),
    // Buttons/keys step a fixed 15% from the CURRENT effective scale
    // (explicit zoom, or the auto-fit value when in fit mode) so the first
    // tap from a 60% fit lands on 75% rather than jumping to a ladder rung.
    zoomIn: () => set((state) => ({
        userZoom: stepZoom(state.userZoom ?? state.fitScale, 1),
    })),
    zoomOut: () => set((state) => ({
        userZoom: stepZoom(state.userZoom ?? state.fitScale, -1),
    })),
    resetZoom: () => set({ userZoom: null }),
    setZoom: (zoom) => set({ userZoom: zoom }),
    setFitScale: (scale) => set({ fitScale: scale }),
    toggleRatioLock: (id, measured) => {
        const state = useCanvasStore.getState();
        const el = state.elements[id];
        if (!el)
            return;
        // Unlock.
        if (state.ratioLocks[id] !== undefined) {
            set((s) => {
                const next = { ...s.ratioLocks };
                delete next[id];
                return { ratioLocks: next };
            });
            return;
        }
        // Lock. Resolve px dims: a fixed axis uses its stored value; a
        // non-fixed axis snaps to fixed using its measured render size,
        // falling back to the stored fallback value when unmeasured.
        const w = el.widthMode === 'fixed' ? el.widthValue : measured?.width ?? el.widthValue;
        const h = el.heightMode === 'fixed' ? el.heightValue : measured?.height ?? el.heightValue;
        if (w <= 0 || h <= 0)
            return;
        const needsConvert = el.widthMode !== 'fixed' || el.heightMode !== 'fixed';
        set((s) => {
            const elements = needsConvert
                ? {
                    ...s.elements,
                    [id]: applyPatchWithAxisRouting(el, {
                        widthMode: 'fixed',
                        widthValue: w,
                        widthCustom: undefined,
                        heightMode: 'fixed',
                        heightValue: h,
                        heightCustom: undefined,
                    }, s.activeBreakpointId, null),
                }
                : s.elements;
            return { elements, ratioLocks: { ...s.ratioLocks, [id]: w / h } };
        });
        // Snapping non-fixed axes to fixed is a real model edit (it changes
        // the emitted CSS), so record it as an undoable size change.
        if (needsConvert) {
            commitElementsToHistory({ kind: 'resize', elementIds: [id] });
        }
    },
    clearRatioLock: (id) => set((s) => {
        if (s.ratioLocks[id] === undefined)
            return s;
        const next = { ...s.ratioLocks };
        delete next[id];
        return { ratioLocks: next };
    }),
    openThemePanel: null,
    setOpenThemePanel: (fn) => set({ openThemePanel: fn }),
});
