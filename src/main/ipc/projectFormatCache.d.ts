import type { ProjectFormat } from '@shared/types';
export declare const setCachedProjectFormat: (projectPath: string, format: ProjectFormat) => void;
export declare const clearCachedProjectFormat: (projectPath: string) => void;
/**
 * Look up the cached format for a project; if not cached, run
 * `detectProjectFormat` against disk and cache the result. Always
 * resolves to a concrete format — never throws.
 */
export declare const getProjectFormat: (projectPath: string) => Promise<ProjectFormat>;
