import { type Dispatch, type SetStateAction } from 'react';
import type { ProjectConfig, ProjectData } from '@shared/types';
import type { DeletePropTextRequest, DetachRequest, LockPropRequest, SlotRemovalRequest } from './types';
type ProjectChange = (next: ProjectData | ((prev: ProjectData) => ProjectData)) => void;
type Args = {
    project: ProjectData;
    onProjectChange?: ProjectChange;
    projectConfig: ProjectConfig;
    onProjectConfigChange: (next: ProjectConfig) => void;
    openComponent: (name: string, fromPage: string | null) => void;
    activePageName: string | null;
};
export type UseInstanceFlows = {
    convertElementId: string | null;
    convertingComponent: boolean;
    convertError: string | null;
    handleConvertToComponent: (elementId: string, name: string) => Promise<void>;
    cancelConvert: () => void;
    lockPropRequest: LockPropRequest | null;
    handleConfirmLockProp: () => void;
    cancelLockProp: () => void;
    deletePropTextRequest: DeletePropTextRequest | null;
    setDeletePropTextRequest: Dispatch<SetStateAction<DeletePropTextRequest | null>>;
    handleConfirmDeletePropText: () => void;
    cancelDeletePropText: () => void;
    detachRequest: DetachRequest | null;
    handleConfirmDetach: () => void;
    cancelDetach: () => void;
    slotRemovalRequest: SlotRemovalRequest | null;
    handleConfirmRemoveSlot: () => void;
    cancelRemoveSlot: () => void;
};
/**
 * Owns the multi-file component-instance flows that ProjectShell drives
 * through confirmation modals: convert-to-component, lock-prop-with-
 * overrides, delete-prop-text-with-overrides, and detach. Each subscribes
 * to its menu/canvas event (except delete-prop-text, which the keyboard
 * handler raises via the exposed setter) and exposes the request state +
 * confirm/cancel handlers the modals bind to.
 * see docs/notes/components-multi-file-ops.md
 */
export declare const useInstanceFlows: ({ project, onProjectChange, projectConfig, onProjectConfigChange, openComponent, activePageName, }: Args) => UseInstanceFlows;
export {};
