import type { ProjectFormat } from '@shared/types';
export declare const addRecentProject: (project: {
    name: string;
    path: string;
    format: ProjectFormat;
}) => Promise<void>;
/**
 * Update the format of a recent-projects entry in place. Called after
 * a successful legacy → nextjs migration so the next open sees the
 * correct format without a re-detect.
 */
export declare const updateRecentProjectFormat: (path: string, format: ProjectFormat) => Promise<void>;
export declare const registerRecentProjectsIpc: () => void;
