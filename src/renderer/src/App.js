import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { ProjectShell } from './components/ProjectShell';
import { SettingsPage } from './components/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSyncBridge } from './syncBridge';
import { useFontsStore } from '@store/fontsSlice';
export const App = () => {
    const [project, setProject] = useState(null);
    const [view, setView] = useState('start');
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
            if (!bootstrap.e2e || !bootstrap.autoOpenProjectPath)
                return;
            const opened = await window.scamp.openProject({
                folderPath: bootstrap.autoOpenProjectPath,
            });
            setProject(opened);
            setView('project');
        })();
    }, []);
    if (view === 'settings') {
        return (_jsx(SettingsPage, { onBack: () => setView(project ? 'project' : 'start') }));
    }
    if (view === 'project' && project) {
        const closingProjectPath = project.path;
        return (_jsx(ErrorBoundary, { children: _jsx(ProjectShell, { project: project, onClose: () => {
                    // Close the preview window and stop its dev server
                    // before tearing down the project — preview shouldn't
                    // outlive the project that's editing it.
                    void window.scamp.closePreview(closingProjectPath);
                    setProject(null);
                    setView('start');
                }, onProjectChange: setProject }) }));
    }
    return (_jsx(StartScreen, { onProjectOpened: (p) => {
            setProject(p);
            setView('project');
        }, onOpenSettings: () => setView('settings') }));
};
