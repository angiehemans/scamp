import { ZOOM_STEPS, } from '../../canvasSlice';
export const createUiSlice = (set) => ({
    bottomPanel: 'none',
    panelMode: 'ui',
    leftSidebarTab: 'layers',
    userZoom: null,
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
    zoomIn: () => set((state) => {
        // Coming from fit-mode, treat the current effective zoom as 1.0
        // (100%). The user pressed "in" — they want to grow, so anchor at
        // 100% rather than the auto-fit value (which might be < 1) so the
        // first tap reliably gets bigger.
        const current = state.userZoom ?? 1;
        const next = ZOOM_STEPS.find((s) => s > current + 1e-3) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
        return { userZoom: next };
    }),
    zoomOut: () => set((state) => {
        const current = state.userZoom ?? 1;
        // Largest step strictly less than current; walk the list backwards.
        let next = ZOOM_STEPS[0];
        for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
            const step = ZOOM_STEPS[i];
            if (step < current - 1e-3) {
                next = step;
                break;
            }
        }
        return { userZoom: next };
    }),
    resetZoom: () => set({ userZoom: null }),
    setZoom: (zoom) => set({ userZoom: zoom }),
    openThemePanel: null,
    setOpenThemePanel: (fn) => set({ openThemePanel: fn }),
});
