import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Top-level shell for an open project: composes the canvas, panels, and
// sidebar, and wires together the projectShell/ hooks that own the real
// logic. Canvas/element state lives in the Zustand store, not here.
//
// The body is now mostly hook calls + a render tree. The logic lives in
// components/projectShell/:
//   useProjectConfig        — scamp.config.json + breakpoint mirror
//   useProjectStoreSync      — project state → canvas store mirrors
//   useFontLinkReconciler /  — font <link> injection + theme.css load
//     useProjectTheme
//   useActiveTarget          — active page/component, load pipeline,
//                              parse-error/migration banners, source
//                              persistence, component enter/exit, nav
//   usePageManagement        — Pages sidebar state + page CRUD
//   useComponentManagement   — Components sidebar state + component CRUD
//   useInstanceFlows         — convert / lock-prop / detach / del-prop-text
//   useCanvasKeyboardShortcuts — global canvas shortcuts + editor Esc
// Render is split into ProjectHeader, PageSidebar, ComponentSidebar,
// CanvasArea, and ProjectModals; only the panel toggles and a thin layout
// frame stay here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { PropertiesPanel } from './PropertiesPanel';
import { CodePanel } from './CodePanel';
import { TerminalPanel } from './TerminalPanel';
import { ElementTree } from './ElementTree';
import { HistoryPanel } from './HistoryPanel';
import { ThemePanel } from './ThemePanel';
import { MigrationBanner } from './MigrationBanner';
import { NextjsMigrationBanner } from './NextjsMigrationBanner';
import { ParseErrorBanner } from './ParseErrorBanner';
import { SaveStatusToast } from './SaveStatusToast';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { ProjectHeader } from './projectShell/ProjectHeader';
import { CanvasArea } from './projectShell/CanvasArea';
import { PageSidebar } from './projectShell/PageSidebar';
import { ComponentSidebar } from './projectShell/ComponentSidebar';
import { ProjectModals } from './projectShell/ProjectModals';
import { useCanvasKeyboardShortcuts } from './projectShell/useCanvasKeyboardShortcuts';
import { useProjectConfig } from './projectShell/useProjectConfig';
import { useSvgAssetReload } from './projectShell/useSvgAssetReload';
import { useSnapshotAutoSave } from './projectShell/useSnapshotAutoSave';
import { useProjectStoreSync } from './projectShell/useProjectStoreSync';
import { useFontLinkReconciler, useProjectTheme, } from './projectShell/useProjectFonts';
import { useActiveTarget } from './projectShell/useActiveTarget';
import { usePageManagement } from './projectShell/usePageManagement';
import { useComponentManagement } from './projectShell/useComponentManagement';
import { useInstanceFlows } from './projectShell/useInstanceFlows';
import { useLatest } from './projectShell/useLatest';
import styles from './ProjectShell.module.css';
export const ProjectShell = ({ project, onClose, onProjectChange, }) => {
    // Per-project config (scamp.config.json) + its canvas-store breakpoint
    // mirror, owned by the hook. Defaults render immediately so the canvas
    // doesn't flash a wrong background while the first read is in flight.
    const { projectConfig, handleProjectConfigChange } = useProjectConfig(project.path);
    const [showProjectSettings, setShowProjectSettings] = useState(false);
    // Ref to the artboard scroll container. Passed to `Viewport` so
    // fit-to-width zoom can observe the real scroll area, and used here
    // for the click-to-deselect handler on empty canvas space.
    const artboardScrollRef = useRef(null);
    // Which page or component is open + the load pipeline, parse-error /
    // migration banner state, source persistence, and component enter/exit.
    const { activePageName, setActivePageName, activeComponent, setActiveComponentState, parseError, clearParseError, showMigrationBanner, handleDismissMigrationBanner, persistActiveSource, openComponent, exitComponentEditor, latestExit, } = useActiveTarget({
        project,
        onProjectChange,
        projectConfig,
        handleProjectConfigChange,
    });
    // Mirror read-only project + config state into the canvas store for
    // deeply-nested readers (format, root path, page list, component-tree
    // cache, active-target canvas min-height).
    useProjectStoreSync({ project, projectConfig, activeComponent });
    // Pages sidebar inline-edit / context-menu state + page CRUD handlers.
    const { existingPageNames, pageEdit, setPageEdit, pageEditBusy, pageEditError, setPageEditError, isEditingPage, resetPageEdit, handleAddPage, handleDuplicatePage, handleRenamePage, openPageMenu, buildMenuItems, pageMenu, closePageMenu, deletingPageName, setDeletingPageName, deletePageError, setDeletePageError, handleDeletePage, } = usePageManagement({
        project,
        onProjectChange,
        activePageName,
        setActivePageName,
        persistActiveSource,
    });
    // Components sidebar inline-edit / context-menu state + the multi-file
    // add / rename / delete handlers.
    const { componentEdit, setComponentEdit, componentEditError, setComponentEditError, creatingComponent, renamingComponent, handleAddComponent, handleRenameComponent, openComponentMenu, componentMenu, closeComponentMenu, requestDeleteComponent, deletingComponent, setDeletingComponent, componentDeleteBusy, handleConfirmDeleteComponent, } = useComponentManagement({
        project,
        onProjectChange,
        activeComponent,
        setActiveComponentState,
        openComponent,
        persistActiveSource,
    });
    const bottomPanel = useCanvasStore((s) => s.bottomPanel);
    const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);
    const leftSidebarTab = useCanvasStore((s) => s.leftSidebarTab);
    const setLeftSidebarTab = useCanvasStore((s) => s.setLeftSidebarTab);
    // Once the user opens the terminal we keep TerminalPanel mounted for
    // the lifetime of the project, even when the panel is hidden, so any
    // long-running pty processes (Claude Code, dev servers, watches…)
    // survive being toggled out of view.
    const [showThemePanel, setShowThemePanel] = useState(false);
    const setOpenThemePanel = useCanvasStore((s) => s.setOpenThemePanel);
    useEffect(() => {
        setOpenThemePanel(() => setShowThemePanel(true));
        return () => setOpenThemePanel(null);
    }, [setOpenThemePanel]);
    const [terminalEverOpened, setTerminalEverOpened] = useState(false);
    useEffect(() => {
        if (bottomPanel === 'terminal')
            setTerminalEverOpened(true);
    }, [bottomPanel]);
    // Reset the "ever opened" flag when the project changes so a fresh
    // project starts with no background pty processes.
    useEffect(() => {
        setTerminalEverOpened(false);
    }, [project.path]);
    // Inject a `<link>` per project font URL so the canvas preview loads the
    // referenced Google Fonts stylesheets, and load theme tokens + font
    // imports from theme.css on open.
    useFontLinkReconciler();
    useProjectTheme(project.path);
    // Auto-save snapshot trigger (every ~5 min of canvas activity), unless
    // disabled via the project's `snapshotAutoSave` config flag.
    useSnapshotAutoSave(project.path, projectConfig.snapshotAutoSave !== false);
    // Background click on the artboard scroll area (outside any frame
    // content) clears selection. Lives here rather than inside Viewport
    // because the scroll container moved up with the "artboard is the
    // scroll" restructure.
    useEffect(() => {
        const node = artboardScrollRef.current;
        if (!node)
            return;
        const handler = (e) => {
            if (e.target === node) {
                useCanvasStore.getState().selectElement(null);
            }
        };
        node.addEventListener('mousedown', handler);
        return () => node.removeEventListener('mousedown', handler);
    }, []);
    const toggleCodePanel = () => {
        setBottomPanel(bottomPanel === 'code' ? 'none' : 'code');
    };
    const toggleTerminalPanel = () => {
        setBottomPanel(bottomPanel === 'terminal' ? 'none' : 'terminal');
    };
    // Preview is gated on the nextjs project format — legacy projects
    // don't have a `package.json` and can't run `next dev`. The button
    // stays visible (so users discover the feature) but is disabled
    // with a tooltip pointing at the migration banner.
    const projectFormatForPreview = useCanvasStore((s) => s.projectFormat);
    const projectPathForPreview = useCanvasStore((s) => s.projectPath);
    const canPreview = projectFormatForPreview === 'nextjs' &&
        projectPathForPreview.length > 0 &&
        activePageName !== null;
    const openPreview = useCallback(() => {
        if (!canPreview || activePageName === null)
            return;
        void window.scamp.openPreview({
            projectPath: projectPathForPreview,
            pageName: activePageName,
            pageNames: project.pages.map((p) => p.name),
        });
    }, [canPreview, projectPathForPreview, activePageName, project.pages]);
    // Push page-list updates to an already-open preview window so the
    // URL-bar dropdown stays current as the user adds / renames /
    // deletes pages in the canvas. No-op when preview isn't open —
    // main bails on a missing window for this project.
    useEffect(() => {
        if (!canPreview || activePageName === null)
            return;
        void window.scamp.updatePreview({
            projectPath: projectPathForPreview,
            pageName: activePageName,
            pageNames: project.pages.map((p) => p.name),
        });
    }, [
        canPreview,
        projectPathForPreview,
        activePageName,
        project.pages,
    ]);
    // Multi-file component-instance flows (convert-to-component, lock-prop,
    // delete-prop-text, detach) + their confirmation-modal state. The
    // delete-prop-text request is raised from the keyboard handler below via
    // `instanceFlows.setDeletePropTextRequest`.
    const instanceFlows = useInstanceFlows({
        project,
        onProjectChange,
        openComponent,
        activePageName,
    });
    // Latest refs for the global keydown effect, which binds once and
    // reads these via `.current` (see useLatest) instead of re-binding.
    const keyDeps = useLatest({
        toggleTerminalPanel,
        canPreview,
        openPreview,
        projectPages: project.pages,
        setDeletePropTextRequest: instanceFlows.setDeletePropTextRequest,
    });
    // Global canvas keyboard shortcuts + component-editor Esc. Bound here
    // (after keyDeps/latestExit exist) rather than earlier in the body.
    useCanvasKeyboardShortcuts(keyDeps, { activeComponent, latestExit });
    useSvgAssetReload();
    return (_jsxs("div", { className: styles.shell, children: [_jsx(ProjectHeader, { projectName: project.name, bottomPanel: bottomPanel, canPreview: canPreview, projectFormat: projectFormatForPreview, onClose: onClose, onToggleCode: toggleCodePanel, onToggleTerminal: toggleTerminalPanel, onOpenPreview: openPreview }), _jsx(SaveStatusToast, {}), showMigrationBanner && (_jsx(MigrationBanner, { onDismiss: handleDismissMigrationBanner })), parseError && (_jsx(ParseErrorBanner, { targetName: parseError.targetName, onDismiss: clearParseError })), project.format === 'legacy' && !projectConfig.nextjsMigrationDismissed && (_jsx(NextjsMigrationBanner, { project: project, onMigrated: (next) => {
                    // Project flips to nextjs format — refresh upward and pick
                    // the home page so the renderer doesn't try to render a
                    // page whose paths just changed under it.
                    onProjectChange?.(next);
                    setActivePageName(next.pages[0]?.name ?? null);
                }, onDismiss: () => handleProjectConfigChange({
                    ...projectConfig,
                    nextjsMigrationDismissed: true,
                }) })), _jsxs("div", { className: styles.body, children: [_jsxs("aside", { className: styles.sidebar, children: [_jsxs("div", { className: styles.sidebarTabStrip, role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": leftSidebarTab === 'layers', className: `${styles.sidebarTab} ${leftSidebarTab === 'layers' ? styles.sidebarTabActive : ''}`, onClick: () => setLeftSidebarTab('layers'), children: "Pages & Layers" }), _jsx("button", { type: "button", role: "tab", "aria-selected": leftSidebarTab === 'history', className: `${styles.sidebarTab} ${leftSidebarTab === 'history' ? styles.sidebarTabActive : ''}`, onClick: () => setLeftSidebarTab('history'), children: "History" })] }), leftSidebarTab === 'history' && (_jsx(HistoryPanel, { projectPath: project.path })), leftSidebarTab === 'layers' && _jsxs(_Fragment, { children: [_jsx(PageSidebar, { pages: project.pages, existingPageNames: existingPageNames, pageEdit: pageEdit, pageEditError: pageEditError, pageEditBusy: pageEditBusy, isEditingPage: isEditingPage, activePageName: activePageName, activeComponent: activeComponent, setPageEdit: setPageEdit, setPageEditError: setPageEditError, resetPageEdit: resetPageEdit, handleAddPage: handleAddPage, handleDuplicatePage: handleDuplicatePage, handleRenamePage: handleRenamePage, openPageMenu: openPageMenu, persistActiveSource: persistActiveSource, setActiveComponentState: setActiveComponentState, setActivePageName: setActivePageName }), _jsx(ComponentSidebar, { components: project.components, projectPath: project.path, componentEdit: componentEdit, componentEditError: componentEditError, renamingComponent: renamingComponent, creatingComponent: creatingComponent, activeComponent: activeComponent, setComponentEdit: setComponentEdit, setComponentEditError: setComponentEditError, handleAddComponent: handleAddComponent, handleRenameComponent: handleRenameComponent, openComponent: openComponent, openComponentMenu: openComponentMenu }), _jsxs("div", { className: `${styles.sidebarSection} ${styles.sidebarLayers}`, "data-testid": "layers-panel", children: [_jsx("h2", { className: styles.sidebarTitle, children: "Layers" }), _jsx(ElementTree, {})] })] })] }), _jsx(CanvasArea, { activeComponent: activeComponent, activePageName: activePageName, projectConfig: projectConfig, artboardScrollRef: artboardScrollRef, onProjectConfigChange: handleProjectConfigChange, onExitComponentEditor: exitComponentEditor, onOpenSettings: () => setShowProjectSettings(true), onOpenTheme: () => setShowThemePanel(true) }), _jsx(PropertiesPanel, {})] }), bottomPanel === 'code' && _jsx(CodePanel, {}), terminalEverOpened && (_jsx(TerminalPanel, { cwd: project.path, hidden: bottomPanel !== 'terminal' }, project.path)), showThemePanel && (_jsx(ThemePanel, { projectPath: project.path, onClose: () => setShowThemePanel(false) })), showProjectSettings && (_jsx(ProjectSettingsPage, { projectName: project.name, projectPath: project.path, config: projectConfig, onChange: handleProjectConfigChange, onBack: () => setShowProjectSettings(false) })), _jsx(ProjectModals, { components: project.components, instanceFlows: instanceFlows, pageMenu: pageMenu, buildMenuItems: buildMenuItems, closePageMenu: closePageMenu, deletingPageName: deletingPageName, deletePageError: deletePageError, handleDeletePage: handleDeletePage, setDeletingPageName: setDeletingPageName, setDeletePageError: setDeletePageError, componentMenu: componentMenu, closeComponentMenu: closeComponentMenu, setComponentEdit: setComponentEdit, setComponentEditError: setComponentEditError, requestDeleteComponent: requestDeleteComponent, deletingComponent: deletingComponent, componentDeleteBusy: componentDeleteBusy, handleConfirmDeleteComponent: handleConfirmDeleteComponent, setDeletingComponent: setDeletingComponent })] }));
};
