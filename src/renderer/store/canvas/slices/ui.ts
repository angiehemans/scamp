// store/canvas/slices/ui.ts — domain slice split from canvasSlice.ts (5.1).
import type { StateCreator } from 'zustand';
import {
  cloneElementSubtree,
  generateElementId,
  groupSiblings,
  reorderElementPure,
  ROOT_ELEMENT_ID,
  ungroupSiblings,
  wrapElement,
  type BreakpointOverride,
  type ElementAnimation,
  type ElementStateName,
  type KeyframesBlock,
  type PropertyGroup,
  type ScampElement,
} from '@lib/element';
import { canonicalizeGroupList } from '@lib/propertyGroups';
import { useHistoryStore, type HistoryCommitInput } from '../../historySlice';
import { PRESETS_BY_NAME, isPresetName } from '@lib/animationPresets';
import { classNameFor } from '@lib/generateCode';
import { resolveElementAtState } from '@lib/stateCascade';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';
import { DEFAULT_BODY_FONT_FAMILY } from '@shared/agentMd';
import {
  DEFAULT_BREAKPOINTS,
  type Breakpoint,
  type ProjectFormat,
  type ThemeToken,
} from '@shared/types';
import {
  defaultTextFontFamily,
  makeComponentInstance,
  makeImage,
  makeInput,
  makeRectangle,
  makeRootElement,
  makeText,
  tagForListChildContext,
} from '../factories';
import {
  BASE_ONLY_PATCH_FIELDS,
  applyPatchWithAxisRouting,
} from '../patchRouting';
import { commitElementsToHistory, freshId } from '../history';
import { stepZoom } from '@lib/zoom';
import {
  useCanvasStore,
  type CanvasState,
  type ActivePage,
  type ActiveComponent,
  type ComponentTree,
  type PageSource,
  type Tool,
  type NewRectInput,
  type NewTextInput,
  type NewImageInput,
  type NewInputInput,
  type NewComponentInstanceInput,
} from '../../canvasSlice';

export const createUiSlice: StateCreator<
  CanvasState,
  [],
  [],
  Pick<
  CanvasState,
  | 'bottomPanel'
  | 'panelMode'
  | 'leftSidebarTab'
  | 'userZoom'
  | 'fitScale'
  | 'exportSettings'
  | 'canvasMinHeight'
  | 'setBottomPanel'
  | 'setPanelMode'
  | 'setLeftSidebarTab'
  | 'setExportFormat'
  | 'setExportPngScale'
  | 'setCanvasMinHeight'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'setZoom'
  | 'setFitScale'
  | 'openThemePanel'
  | 'setOpenThemePanel'
>
> = (set) => ({
  bottomPanel: 'none',
  panelMode: 'ui',
  leftSidebarTab: 'layers',
  userZoom: null,
  fitScale: 1,
  exportSettings: { lastFormat: 'png', lastPngScale: 2 },
  // Default matches the page-editor canvas. ProjectShell
  // overrides this when entering the component editor so the
  // canvas reflects the per-component height.
  canvasMinHeight: 900,
  setBottomPanel: (panel) => set({ bottomPanel: panel }),

  setPanelMode: (mode) => set({ panelMode: mode }),

  setLeftSidebarTab: (tab) => set({ leftSidebarTab: tab }),

  setExportFormat: (format) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, lastFormat: format },
    })),

  setExportPngScale: (scale) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, lastPngScale: scale },
    })),

  setCanvasMinHeight: (value) => set({ canvasMinHeight: value }),
  // Buttons/keys step a fixed 15% from the CURRENT effective scale
  // (explicit zoom, or the auto-fit value when in fit mode) so the first
  // tap from a 60% fit lands on 75% rather than jumping to a ladder rung.
  zoomIn: () =>
    set((state) => ({
      userZoom: stepZoom(state.userZoom ?? state.fitScale, 1),
    })),

  zoomOut: () =>
    set((state) => ({
      userZoom: stepZoom(state.userZoom ?? state.fitScale, -1),
    })),

  resetZoom: () => set({ userZoom: null }),

  setZoom: (zoom) => set({ userZoom: zoom }),

  setFitScale: (scale) => set({ fitScale: scale }),

  openThemePanel: null,
  setOpenThemePanel: (fn) => set({ openThemePanel: fn }),

});
