import { stepZoom } from '@lib/zoom';
export const createUiSlice = (set) => ({
    bottomPanel: 'none',
    panelMode: 'ui',
    leftSidebarTab: 'layers',
    userZoom: null,
    fitScale: 1,
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
    openThemePanel: null,
    setOpenThemePanel: (fn) => set({ openThemePanel: fn }),
});
