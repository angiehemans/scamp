import type { ProjectConfig } from '@shared/types';
/**
 * Ensure a project folder has a `scamp.config.json`. Used on project
 * create and on open so older projects backfill to the defaults.
 * Returns the config currently on disk after the backfill.
 */
export declare const ensureProjectConfig: (projectPath: string) => Promise<ProjectConfig>;
export declare const registerProjectConfigIpc: () => void;
