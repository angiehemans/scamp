import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createElementsEditSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'previewAnimation' | 'setPropOverride' | 'clearPropOverride' | 'setElementText' | 'togglePropOnText' | 'renamePropOnText' | 'moveElement' | 'resizeElement' | 'patchElement' | 'patchCustomProperties' | 'resetElementFieldsAtBreakpoint' | 'resetElementFieldsAtState' | 'setAnimation' | 'removeAnimation' | 'togglePropertyGroup' | 'playAnimation'>>;
