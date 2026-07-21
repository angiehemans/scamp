import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createDesignSystemSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'activeBreakpointId' | 'activeStateName' | 'breakpoints' | 'themeTokens' | 'themeBaseTokens' | 'themeOverrides' | 'themes' | 'activeThemeId' | 'setActiveBreakpoint' | 'setActiveState' | 'setBreakpoints' | 'setThemeTokens' | 'setThemeData' | 'setActiveTheme'>>;
