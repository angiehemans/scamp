export const createProjectSlice = (set) => ({
    projectFormat: 'nextjs',
    projectPath: '',
    pageNames: [],
    pendingPageNavigation: null,
    pendingComponentNavigation: null,
    setProjectFormat: (projectFormat) => set({ projectFormat }),
    setPageNames: (pageNames) => set({ pageNames }),
    requestPageNavigation: (pendingPageNavigation) => set({ pendingPageNavigation }),
    requestComponentNavigation: (pendingComponentNavigation) => set({ pendingComponentNavigation }),
    setProjectPath: (projectPath) => set({ projectPath }),
});
