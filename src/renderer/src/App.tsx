import { useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectShell } from './components/ProjectShell';
import { SettingsPage } from './components/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSyncBridge } from './syncBridge';
import { useFontsStore } from '@store/fontsSlice';
import type { ProjectData } from '@shared/types';

type View = 'start' | 'project' | 'settings';

export const App = (): JSX.Element => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [view, setView] = useState<View>('start');

  useEffect(() => {
    return initSyncBridge();
  }, []);

  // Warm the system-font list on app start. The call is cheap on a
  // warm session and falls back to a baseline list if the Local Font
  // Access API isn't available.
  useEffect(() => {
    void useFontsStore.getState().loadSystemFonts();
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
      <ErrorBoundary>
        <ProjectShell
          project={project}
          onClose={() => {
            setProject(null);
            setView('start');
          }}
          onProjectChange={setProject}
        />
      </ErrorBoundary>
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
