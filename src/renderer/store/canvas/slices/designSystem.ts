// store/canvas/slices/designSystem.ts — domain slice split from canvasSlice.ts (5.1).
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

export const createDesignSystemSlice: StateCreator<
  CanvasState,
  [],
  [],
  Pick<
  CanvasState,
  | 'activeBreakpointId'
  | 'activeStateName'
  | 'breakpoints'
  | 'themeTokens'
  | 'setActiveBreakpoint'
  | 'setActiveState'
  | 'setBreakpoints'
  | 'setThemeTokens'
>
> = (set) => ({
  activeBreakpointId: 'desktop',
  activeStateName: null,
  breakpoints: [...DEFAULT_BREAKPOINTS],
  themeTokens: [],
  setActiveBreakpoint: (id) => set({ activeBreakpointId: id }),

  setActiveState: (activeStateName) => set({ activeStateName }),

  setBreakpoints: (breakpoints) => set({ breakpoints }),

  setThemeTokens: (tokens) => set({ themeTokens: tokens }),

});
