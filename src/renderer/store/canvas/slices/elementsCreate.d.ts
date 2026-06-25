import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createElementsCreateSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'elements' | 'rootElementId' | 'clipboard' | 'createRectangle' | 'createText' | 'createImage' | 'createInput' | 'insertComponentInstance' | 'replaceSubtreeWithInstance' | 'detachInstance' | 'renameComponentReferences' | 'deleteElement' | 'duplicateElement' | 'copyElement' | 'pasteElement' | 'groupElements' | 'ungroupElement' | 'wrapInLinkParent' | 'reorderElement' | 'reparentElement'>>;
