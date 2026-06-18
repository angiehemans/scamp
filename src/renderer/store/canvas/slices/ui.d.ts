import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createUiSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'bottomPanel' | 'panelMode' | 'leftSidebarTab' | 'userZoom' | 'exportSettings' | 'canvasMinHeight' | 'setBottomPanel' | 'setPanelMode' | 'setLeftSidebarTab' | 'setExportFormat' | 'setExportPngScale' | 'setCanvasMinHeight' | 'zoomIn' | 'zoomOut' | 'resetZoom' | 'setZoom' | 'openThemePanel' | 'setOpenThemePanel'>>;
