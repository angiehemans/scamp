import type { ProjectConfig } from '@shared/types';
export declare const CONFIG_FILE = "scamp.config.json";
/** Read `scamp.config.json` from a project, defaulting if absent/invalid. */
export declare const readConfig: (projectPath: string) => Promise<ProjectConfig>;
/** Write `scamp.config.json` and return the config that was written. */
export declare const writeConfig: (projectPath: string, config: ProjectConfig) => Promise<ProjectConfig>;
/**
 * Ensure a project folder has a `scamp.config.json`. Used on project
 * create and on open so older projects backfill to the defaults.
 * Returns the config currently on disk after the backfill.
 */
export declare const ensureProjectConfig: (projectPath: string) => Promise<ProjectConfig>;
