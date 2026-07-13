import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createUiSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'bottomPanel' | 'panelMode' | 'leftSidebarTab' | 'userZoom' | 'fitScale' | 'exportSettings' | 'canvasMinHeight' | 'setBottomPanel' | 'setPanelMode' | 'setLeftSidebarTab' | 'setExportFormat' | 'setExportPngScale' | 'setCanvasMinHeight' | 'zoomIn' | 'zoomOut' | 'resetZoom' | 'setZoom' | 'setFitScale' | 'openThemePanel' | 'setOpenThemePanel'>>;
