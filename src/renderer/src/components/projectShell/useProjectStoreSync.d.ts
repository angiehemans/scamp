import type { ProjectConfig, ProjectData } from '@shared/types';
import type { ActiveComponent } from './types';
type Args = {
    project: ProjectData;
    projectConfig: ProjectConfig;
    activeComponent: ActiveComponent | null;
};
/**
 * Pushes the read-only project + config state that deeply-nested canvas
 * components need into the canvas store, so they don't have to prop-drill
 * or walk paths: the project format (for the sync bridge's CSS-module
 * import basename), root path, page-name list, the parsed component-tree
 * cache (instances render from it), and the active target's canvas
 * min-height.
 */
export declare const useProjectStoreSync: ({ project, projectConfig, activeComponent, }: Args) => void;
export {};
