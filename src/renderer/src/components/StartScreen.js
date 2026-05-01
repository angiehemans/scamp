import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { basename } from '../lib/path';
import { CreateProjectModal } from './CreateProjectModal';
import { Tooltip } from './controls/Tooltip';
import styles from './StartScreen.module.css';
export const StartScreen = ({ onProjectOpened, onOpenSettings }) => {
    const [recents, setRecents] = useState([]);
    const [settings, setSettings] = useState(null);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const refreshRecents = useCallback(async () => {
        const list = await window.scamp.getRecentProjects();
        setRecents(list);
    }, []);
    const refreshSettings = useCallback(async () => {
        const next = await window.scamp.getSettings();
        setSettings(next);
    }, []);
    useEffect(() => {
        void refreshRecents();
        void refreshSettings();
    }, [refreshRecents, refreshSettings]);
    const defaultFolder = settings?.defaultProjectsFolder ?? null;
    const handlePickDefaultFolder = async () => {
        setError(null);
        try {
            const result = await window.scamp.chooseFolder();
            if (result.canceled || !result.path)
                return;
            const next = await window.scamp.setDefaultProjectsFolder(result.path);
            if (next && typeof next === 'object' && 'defaultProjectsFolder' in next) {
                setSettings(next);
            }
            else {
                await refreshSettings();
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    const handleClearDefaultFolder = async () => {
        setError(null);
        try {
            const next = await window.scamp.setDefaultProjectsFolder(null);
            if (next && typeof next === 'object' && 'defaultProjectsFolder' in next) {
                setSettings(next);
            }
            else {
                await refreshSettings();
            }
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    const handleCreateProject = async (name) => {
        if (!defaultFolder)
            return;
        const project = await window.scamp.createProject({
            parentPath: defaultFolder,
            name,
        });
        onProjectOpened(project);
    };
    const handleOpenProject = async () => {
        setError(null);
        const result = await window.scamp.chooseFolder();
        if (result.canceled || !result.path)
            return;
        try {
            const project = await window.scamp.openProject({ folderPath: result.path });
            onProjectOpened(project);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    const handleOpenRecent = async (recent) => {
        if (!recent.exists)
            return;
        setError(null);
        try {
            const project = await window.scamp.openProject({ folderPath: recent.path });
            onProjectOpened(project);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    const handleRemoveRecent = async (path) => {
        await window.scamp.removeRecentProject(path);
        await refreshRecents();
    };
    // ---- Render ----
    const renderMain = () => {
        // First-run: no default folder yet.
        if (settings && !defaultFolder) {
            return (_jsxs("div", { className: styles.welcomeState, children: [_jsx("h2", { className: styles.welcomeHeading, children: "Welcome to Scamp" }), _jsx("p", { className: styles.welcomeText, children: "Pick a default folder where new projects will live. Each project gets its own subfolder inside it. You can change this later." }), _jsx("button", { className: styles.welcomeButton, onClick: handlePickDefaultFolder, type: "button", children: "Choose Folder" })] }));
        }
        return (_jsxs(_Fragment, { children: [_jsx("h2", { className: styles.recentTitle, children: "Recent Projects" }), error && _jsx("div", { className: styles.error, children: error }), recents.length === 0 ? (_jsx("div", { className: styles.emptyState, children: "No recent projects yet." })) : (_jsx("ul", { className: styles.recentList, children: recents.map((recent) => (_jsxs("li", { className: `${styles.recentItem} ${recent.exists ? '' : styles.recentMissing}`, children: [_jsxs("button", { className: styles.recentButton, onClick: () => handleOpenRecent(recent), disabled: !recent.exists, type: "button", children: [_jsx("span", { className: styles.recentName, children: recent.name }), _jsx("span", { className: styles.recentPath, children: recent.path }), !recent.exists && (_jsx("span", { className: styles.recentLabel, children: "Folder not found" }))] }), _jsx(Tooltip, { label: "Remove from list", children: _jsx("button", { className: styles.recentRemove, onClick: () => handleRemoveRecent(recent.path), type: "button", children: "x" }) })] }, recent.path))) }))] }));
    };
    return (_jsxs("div", { className: styles.screen, children: [_jsxs("aside", { className: styles.sidebar, children: [_jsx("h1", { className: styles.sidebarTitle, children: "Scamp" }), _jsx("p", { className: styles.sidebarSubtitle, children: "Local design tool \u2014 draw, get real code." }), _jsxs("div", { className: styles.sidebarActions, children: [_jsx("button", { className: styles.primary, onClick: () => setShowCreateModal(true), type: "button", disabled: !defaultFolder, children: "New Project" }), _jsx("button", { className: styles.secondary, onClick: handleOpenProject, type: "button", children: "Open Project" })] }), _jsx("div", { className: styles.sidebarSpacer }), _jsx("button", { className: styles.linkButton, onClick: onOpenSettings, type: "button", style: { marginBottom: 16 }, children: "Settings" }), defaultFolder && (_jsxs("div", { className: styles.sidebarFooter, children: [_jsx("span", { className: styles.footerLabel, children: "Default folder" }), _jsx(Tooltip, { label: defaultFolder, children: _jsx("span", { className: styles.footerPath, children: defaultFolder }) }), _jsxs("div", { className: styles.footerLinks, children: [_jsx("button", { className: styles.linkButton, onClick: handlePickDefaultFolder, type: "button", children: "Change" }), _jsx("button", { className: styles.linkButton, onClick: handleClearDefaultFolder, type: "button", children: "Clear" })] })] }))] }), _jsx("main", { className: styles.main, children: renderMain() }), showCreateModal && defaultFolder && (_jsx(CreateProjectModal, { defaultFolder: defaultFolder, onSubmit: handleCreateProject, onCancel: () => setShowCreateModal(false) }))] }));
};
export const projectNameFromPath = (p) => basename(p);
