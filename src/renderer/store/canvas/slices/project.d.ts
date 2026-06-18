import type { StateCreator } from 'zustand';
import { type CanvasState } from '../../canvasSlice';
export declare const createProjectSlice: StateCreator<CanvasState, [
], [
], Pick<CanvasState, 'projectFormat' | 'projectPath' | 'pageNames' | 'pendingPageNavigation' | 'pendingComponentNavigation' | 'setProjectFormat' | 'setPageNames' | 'requestPageNavigation' | 'requestComponentNavigation' | 'setProjectPath'>>;
