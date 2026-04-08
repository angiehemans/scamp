import { useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectShell } from './components/ProjectShell';
import { initSyncBridge } from './syncBridge';
import type { ProjectData } from '@shared/types';

export const App = (): JSX.Element => {
  const [project, setProject] = useState<ProjectData | null>(null);

  useEffect(() => {
    return initSyncBridge();
  }, []);

  if (!project) {
    return <StartScreen onProjectOpened={setProject} />;
  }
  return <ProjectShell project={project} onClose={() => setProject(null)} />;
};
