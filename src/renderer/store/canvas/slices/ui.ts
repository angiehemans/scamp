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
import {
  useCanvasStore,
  ZOOM_STEPS,
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
  | 'openThemePanel'
  | 'setOpenThemePanel'
>
> = (set) => ({
  bottomPanel: 'none',
  panelMode: 'ui',
  leftSidebarTab: 'layers',
  userZoom: null,
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
  zoomIn: () =>
    set((state) => {
      // Coming from fit-mode, treat the current effective zoom as 1.0
      // (100%). The user pressed "in" — they want to grow, so anchor at
      // 100% rather than the auto-fit value (which might be < 1) so the
      // first tap reliably gets bigger.
      const current = state.userZoom ?? 1;
      const next =
        ZOOM_STEPS.find((s) => s > current + 1e-3) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
      return { userZoom: next };
    }),

  zoomOut: () =>
    set((state) => {
      const current = state.userZoom ?? 1;
      // Largest step strictly less than current; walk the list backwards.
      let next: number = ZOOM_STEPS[0]!;
      for (let i = ZOOM_STEPS.length - 1; i >= 0; i -= 1) {
        const step = ZOOM_STEPS[i]!;
        if (step < current - 1e-3) {
          next = step;
          break;
        }
      }
      return { userZoom: next };
    }),

  resetZoom: () => set({ userZoom: null }),

  setZoom: (zoom) => set({ userZoom: zoom }),

  openThemePanel: null,
  setOpenThemePanel: (fn) => set({ openThemePanel: fn }),

});
