import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createDesignSystemSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'activeBreakpointId' | 'activeStateName' | 'breakpoints' | 'themeTokens' | 'setActiveBreakpoint' | 'setActiveState' | 'setBreakpoints' | 'setThemeTokens'>>;
