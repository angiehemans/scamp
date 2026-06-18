import type { ProjectConfig } from '@shared/types';
export type UseProjectConfigResult = {
    projectConfig: ProjectConfig;
    handleProjectConfigChange: (next: ProjectConfig) => void;
};
/**
 * Owns the per-project `scamp.config.json`: reads it on open (defaults
 * render immediately so the canvas doesn't flash a wrong background while
 * the first read is in flight), exposes a change handler that writes back,
 * and mirrors the breakpoint table into the canvas store so deeply-nested
 * components can read it without prop drilling.
 */
export declare const useProjectConfig: (projectPath: string) => UseProjectConfigResult;
