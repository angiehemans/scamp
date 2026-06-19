import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createDocumentSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'activePage' | 'activeComponent' | 'pageSource' | 'isLoading' | 'lastLoadKind' | 'cssDuplicates' | 'pageCustomMediaBlocks' | 'pageKeyframesBlocks' | 'componentTrees' | 'snapshotPreview' | 'enterSnapshotPreview' | 'exitSnapshotPreview' | 'clearSnapshotPreview' | 'loadPage' | 'loadComponent' | 'reloadElements' | 'setPageSource' | 'setComponentTrees' | 'resetForNewPage'>>;
