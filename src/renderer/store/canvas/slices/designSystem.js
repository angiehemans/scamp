import { DEFAULT_BREAKPOINTS, } from '@shared/types';
export const createDesignSystemSlice = (set) => ({
    activeBreakpointId: 'desktop',
    activeStateName: null,
    breakpoints: [...DEFAULT_BREAKPOINTS],
    themeTokens: [],
    setActiveBreakpoint: (id) => set({ activeBreakpointId: id }),
    setActiveState: (activeStateName) => set({ activeStateName }),
    setBreakpoints: (breakpoints) => set({ breakpoints }),
    setThemeTokens: (tokens) => set({ themeTokens: tokens }),
});
