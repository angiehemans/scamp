import { useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectShell } from './components/ProjectShell';
import { SettingsPage } from './components/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SentryOptInPrompt } from './components/SentryOptInPrompt';
import { initSyncBridge } from './syncBridge';
import { useFontsStore } from '@store/fontsSlice';
import type { ProjectData } from '@shared/types';

type View = 'start' | 'project' | 'settings';

/**
 * Crash-reporting opt-in state. `null` while we're reading the
 * stored pref via IPC; `'pending'` when the user has not been
 * asked yet (the prompt is rendered); `'resolved'` once they've
 * decided either way (regardless of which way). Only `'resolved'`
 * lets the rest of the app render — we don't want the user
 * distracted by the prompt mid-session.
 */
type OptInState = 'loading' | 'pending' | 'resolved';

export const App = (): JSX.Element => {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [view, setView] = useState<View>('start');
  const [optInState, setOptInState] = useState<OptInState>('loading');

  // On mount, read settings.sentryOptIn. `null` (or any error
  // reading the file) → show the opt-in prompt. `true` or `false`
  // → user has already decided, render the app normally.
  useEffect(() => {
    void (async () => {
      try {
        const settings = await window.scamp.getSettings();
        setOptInState(settings.sentryOptIn === null ? 'pending' : 'resolved');
      } catch {
        // Settings read failed — fall through to the prompt so the
        // user can still make a choice this session.
        setOptInState('pending');
      }
    })();
  }, []);

  const handleOptInDecision = async (optedIn: boolean): Promise<void> => {
    try {
      await window.scamp.updateSettings({ sentryOptIn: optedIn });
      await window.scamp.reinitSentry(optedIn);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[opt-in] persist failed:', err);
    }
    setOptInState('resolved');
  };

  useEffect(() => {
    return initSyncBridge();
  }, []);

  // Warm the system-font list on app start. The call is cheap on a
  // warm session and falls back to a baseline list if the Local Font
  // Access API isn't available.
  useEffect(() => {
    void useFontsStore.getState().loadSystemFonts();
  }, []);

  // E2E hook: when the main process was launched with SCAMP_E2E=1 and
  // SCAMP_E2E_OPEN_PROJECT points at a seeded project folder, skip the
  // Start Screen and jump straight into that project. Disabled in
  // normal use — the bootstrap flags are null unless the env var is set.
  useEffect(() => {
    void (async () => {
      const bootstrap = await window.scamp.getTestBootstrap();
      if (!bootstrap.e2e || !bootstrap.autoOpenProjectPath) return;
      const opened = await window.scamp.openProject({
        folderPath: bootstrap.autoOpenProjectPath,
      });
      setProject(opened);
      setView('project');
    })();
  }, []);

  // First-launch crash-reporting opt-in. Renders before anything
  // else so the user makes the choice before any project loads.
  if (optInState === 'loading') {
    // Brief blank state while the IPC round-trip resolves. Avoids
    // a flash of the StartScreen before the prompt mounts.
    return <></>;
  }
  if (optInState === 'pending') {
    return (
      <SentryOptInPrompt
        onDecision={(optedIn) => void handleOptInDecision(optedIn)}
      />
    );
  }

  if (view === 'settings') {
    return (
      <SettingsPage
        onBack={() => setView(project ? 'project' : 'start')}
      />
    );
  }

  if (view === 'project' && project) {
    const closingProjectPath = project.path;
    return (
      <ErrorBoundary>
        <ProjectShell
          project={project}
          onClose={() => {
            // Close the preview window and stop its dev server
            // before tearing down the project — preview shouldn't
            // outlive the project that's editing it.
            void window.scamp.closePreview(closingProjectPath);
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
