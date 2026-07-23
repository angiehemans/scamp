import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createDesignSystemSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'activeBreakpointId' | 'activeStateName' | 'breakpoints' | 'themeTokens' | 'themeBaseTokens' | 'themeOverrides' | 'themes' | 'activeThemeId' | 'themeCssRaw' | 'designProse' | 'setActiveBreakpoint' | 'setActiveState' | 'setBreakpoints' | 'setThemeTokens' | 'setThemeData' | 'setActiveTheme' | 'setThemeCssRaw' | 'setDesignProse'>>;
