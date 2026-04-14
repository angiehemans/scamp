import { useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectShell } from './components/ProjectShell';
import { SettingsPage } from './components/SettingsPage';
import { initSyncBridge } from './syncBridge';
import type { ProjectData } from '@shared/types';

type View = 'start' | 'project' | 'settings';

export const App = (): JSX.Element => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [view, setView] = useState<View>('start');

  useEffect(() => {
    return initSyncBridge();
  }, []);

  if (view === 'settings') {
    return (
      <SettingsPage
        onBack={() => setView(project ? 'project' : 'start')}
      />
    );
  }

  if (view === 'project' && project) {
    return (
      <ProjectShell
        project={project}
        onClose={() => {
          setProject(null);
          setView('start');
        }}
        onProjectChange={setProject}
        onOpenSettings={() => setView('settings')}
      />
    );
  }

  return (
    <StartScreen
      onProjectOpened={(p) => {
        setProject(p);
        setView('project');
      }}
      onOpenSettings={() => setView('settings')}
    />
  );
};
