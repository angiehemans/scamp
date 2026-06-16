// store/canvas/slices/project.ts — domain slice split from canvasSlice.ts (5.1).
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

export const createProjectSlice: StateCreator<
  CanvasState,
  [],
  [],
  Pick<
  CanvasState,
  | 'projectFormat'
  | 'projectPath'
  | 'pageNames'
  | 'pendingPageNavigation'
  | 'pendingComponentNavigation'
  | 'setProjectFormat'
  | 'setPageNames'
  | 'requestPageNavigation'
  | 'requestComponentNavigation'
  | 'setProjectPath'
>
> = (set) => ({
  projectFormat: 'nextjs',
  projectPath: '',
  pageNames: [],
  pendingPageNavigation: null,
  pendingComponentNavigation: null,
  setProjectFormat: (projectFormat) => set({ projectFormat }),
  setPageNames: (pageNames) => set({ pageNames }),

  requestPageNavigation: (pendingPageNavigation) =>
    set({ pendingPageNavigation }),

  requestComponentNavigation: (pendingComponentNavigation) =>
    set({ pendingComponentNavigation }),

  setProjectPath: (projectPath) => set({ projectPath }),

});
