import { type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react';
import type { ProjectData } from '@shared/types';
import type { ActiveComponent, ComponentEdit, ComponentMenuState, DeletingComponent } from './types';
type ProjectChange = (next: ProjectData | ((prev: ProjectData) => ProjectData)) => void;
type Args = {
    project: ProjectData;
    onProjectChange?: ProjectChange;
    activeComponent: ActiveComponent | null;
    setActiveComponentState: (next: ActiveComponent | null) => void;
    openComponent: (name: string, fromPage: string | null) => void;
    persistActiveSource: () => void;
};
export type UseComponentManagement = {
    componentEdit: ComponentEdit;
    setComponentEdit: Dispatch<SetStateAction<ComponentEdit>>;
    componentEditError: string | null;
    setComponentEditError: Dispatch<SetStateAction<string | null>>;
    creatingComponent: boolean;
    renamingComponent: boolean;
    handleAddComponent: (name: string) => Promise<void>;
    handleRenameComponent: (oldName: string, newName: string) => Promise<void>;
    openComponentMenu: (e: ReactMouseEvent, componentName: string) => void;
    componentMenu: ComponentMenuState | null;
    closeComponentMenu: () => void;
    requestDeleteComponent: (componentName: string) => void;
    deletingComponent: DeletingComponent | null;
    setDeletingComponent: Dispatch<SetStateAction<DeletingComponent | null>>;
    componentDeleteBusy: boolean;
    handleConfirmDeleteComponent: () => Promise<void>;
};
/**
 * Owns the Components sidebar's inline-edit + context-menu state and the
 * multi-file component-management handlers: add (create + enter editor),
 * rename (rewrite the component + every referencing page, rekey nothing —
 * pages keep their order), and delete (strip every instance from each
 * page, then remove the folder). Delete/rename arm target-swap
 * suppression so the watcher doesn't fight the in-flight multi-file write.
 * see docs/notes/components-multi-file-ops.md
 */
export declare const useComponentManagement: ({ project, onProjectChange, activeComponent, setActiveComponentState, openComponent, persistActiveSource, }: Args) => UseComponentManagement;
export {};
