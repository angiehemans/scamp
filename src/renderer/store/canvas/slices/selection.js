export const createSelectionSlice = (set) => ({
    selectedElementIds: [],
    editingElementId: null,
    editingInstanceProp: null,
    activeTool: 'select',
    setTool: (tool) => set({ activeTool: tool }),
    selectElement: (id) => set({ selectedElementIds: id === null ? [] : [id] }),
    toggleSelectElement: (id) => set((state) => {
        const idx = state.selectedElementIds.indexOf(id);
        if (idx >= 0) {
            const next = [...state.selectedElementIds];
            next.splice(idx, 1);
            return { selectedElementIds: next };
        }
        return { selectedElementIds: [...state.selectedElementIds, id] };
    }),
    setEditingElement: (id) => set({ editingElementId: id }),
    setEditingInstanceProp: (value) => set({ editingInstanceProp: value }),
});
