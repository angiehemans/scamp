import type { StateCreator } from 'zustand';
import type { CanvasState } from '../../canvasSlice';
/**
 * Bindings on the Data tab: attribute, event, repeat, and show, plus
 * the sample data behind repeat and show on the root. Text props live
 * in elementsEdit (`togglePropOnText`). Every action commits one
 * history entry. see docs/notes/view-bindings.md
 */
export type BindingsSlice = Pick<CanvasState, 'setAttributeBinding' | 'setEventBinding' | 'setRepeat' | 'setShowIf' | 'setSampleFlag' | 'setSampleRows' | 'renameBindingProp'>;
export declare const createBindingsSlice: StateCreator<CanvasState, [], [], BindingsSlice>;
