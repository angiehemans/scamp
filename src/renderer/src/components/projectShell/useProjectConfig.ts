import { useCallback, useEffect, useState } from 'react';

import type { ProjectConfig } from '@shared/types';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';

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
export const useProjectConfig = (
  projectPath: string
): UseProjectConfigResult => {
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(
    DEFAULT_PROJECT_CONFIG
  );

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const next = await window.scamp.readProjectConfig({ projectPath });
      if (!cancelled) setProjectConfig(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const handleProjectConfigChange = useCallback(
    (next: ProjectConfig): void => {
      setProjectConfig(next);
      void window.scamp.writeProjectConfig({ projectPath, config: next });
    },
    [projectPath]
  );

  // Mirror the project's breakpoint table into the canvas store so
  // deeply-nested components (ElementRenderer, cascaded styles) can
  // read it without prop drilling.
  useEffect(() => {
    useCanvasStore.getState().setBreakpoints(projectConfig.breakpoints);
  }, [projectConfig.breakpoints]);

  return { projectConfig, handleProjectConfigChange };
};
