import type { ProjectData } from '@shared/types';
type Props = {
    project: ProjectData;
    onClose: () => void;
    /**
     * Called after a page or component change. Accepts either a
     * replacement `ProjectData` OR a functional updater that
     * receives the latest committed state. Multi-step handlers
     * (convert-to-component, rename, etc.) MUST use the functional
     * form so sequential calls compose against React's queued
     * state instead of stomping each other via stale closure refs.
     */
    onProjectChange?: (next: ProjectData | ((prev: ProjectData) => ProjectData)) => void;
};
export declare const ProjectShell: ({ project, onClose, onProjectChange, }: Props) => JSX.Element;
export {};
