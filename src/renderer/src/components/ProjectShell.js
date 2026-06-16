import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Top-level shell for an open project: owns page/component navigation,
// the load pipeline (parseCode → store), and every page/component CRUD
// handler. Canvas/element state lives in the Zustand store, not here.
// Sections (line ranges approximate — navigate by the named anchors):
//   ~100-186   local state hooks (active page/component, edit/menu state,
//              projectConfig, parseError, refs)
//   ~188-540   effects: config load, component-tree parse, navigation
//              requests, font/theme injection, page-load + component-load
//              (the two parseCode call sites + ParseErrorBanner trigger)
//   ~543-880   panel toggles, preview sync, global keyboard shortcuts
//   ~881-1005  page CRUD (handleAddPage / Duplicate / Rename / Delete)
//   ~1006-1146 component editor: persistActiveSource, openComponent,
//              exitComponentEditor, handleAddComponent
//   ~1147-1408 instance flows: convert-to-component, lock-prop,
//              delete-prop-text, detach, component context menu + delete
//   ~1410-1575 handleRenameComponent + page context-menu builder
//   ~1576-end  render: header toolbar, banners, sidebar, viewport,
//              bottom panels + modals/dialogs
import { useCallback, useEffect, useRef, useState, } from 'react';
import { errorMessage } from '@shared/errorMessage';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { useAppLogStore } from '@store/appLogSlice';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { armTargetSwapSuppression, disarmTargetSwapSuppression, flushPendingPageWrite, } from '../syncBridge';
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
import { PageNameInput } from './PageNameInput';
import { ComponentNameInput } from './ComponentNameInput';
import { PageContextMenu } from './PageContextMenu';
import { ElementContextMenu } from './ElementContextMenu';
import { CreateComponentDialog } from './CreateComponentDialog';
import { ComponentSidebarItem } from './ComponentSidebarItem';
import { findInstanceUsagesAcrossPages, groupUsagesByPage, } from '@lib/componentUsage';
import { rewriteComponentForRename, rewritePageForComponentRename, } from '@lib/componentRename';
import { ConfirmDialog } from './ConfirmDialog';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { ProjectHeader } from './projectShell/ProjectHeader';
import { CanvasArea } from './projectShell/CanvasArea';
import { useCanvasKeyboardShortcuts } from './projectShell/useCanvasKeyboardShortcuts';
import { useProjectConfig } from './projectShell/useProjectConfig';
import { useProjectStoreSync } from './projectShell/useProjectStoreSync';
import { useFontLinkReconciler, useProjectTheme, } from './projectShell/useProjectFonts';
import { useActiveTarget } from './projectShell/useActiveTarget';
import { useInstanceFlows } from './projectShell/useInstanceFlows';
import { useLatest } from './projectShell/useLatest';
import styles from './ProjectShell.module.css';
export const ProjectShell = ({ project, onClose, onProjectChange, }) => {
    // Brief in-progress flag while `+ component` is creating a new
    // component on disk. Disables the add-button + name input.
    const [creatingComponent, setCreatingComponent] = useState(false);
    // Inline-edit state for the components list.
    //   `'new'` — PascalCase name input at the bottom (Create).
    //   `{ rename: name }` — replaces that component's button with
    //     a name input pre-filled with `name`.
    //   `null` — no editing in progress.
    const [componentEdit, setComponentEdit] = useState(null);
    const [componentEditError, setComponentEditError] = useState(null);
    const [renamingComponent, setRenamingComponent] = useState(false);
    // Pages sidebar inline-edit state. `'new'` shows the Add Page input at
    // the bottom of the list. `{ duplicate: name }` replaces the named row
    // with an input seeded from that page. `null` means no editing in
    // progress and the sidebar behaves normally.
    const [pageEdit, setPageEdit] = useState(null);
    const [pageEditBusy, setPageEditBusy] = useState(false);
    const [pageEditError, setPageEditError] = useState(null);
    // Right-click context menu — stores the viewport coords and the page
    // name the menu was opened for.
    const [pageMenu, setPageMenu] = useState(null);
    // Page pending deletion (confirmation dialog is open).
    const [deletingPageName, setDeletingPageName] = useState(null);
    // Inline error shown in the delete-confirmation dialog when the
    // delete IPC fails; keeps the dialog open so the user can retry.
    const [deletePageError, setDeletePageError] = useState(null);
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
    // ---- Page management ----
    const existingPageNames = project.pages.map((p) => p.name);
    const resetPageEdit = () => {
        setPageEdit(null);
        setPageEditBusy(false);
        setPageEditError(null);
    };
    const handleAddPage = async (name) => {
        setPageEditBusy(true);
        setPageEditError(null);
        try {
            const newPage = await window.scamp.createPage({
                projectPath: project.path,
                pageName: name,
            });
            // Mirror the outgoing page's in-memory state into project.pages
            // BEFORE switching. Without this, returning later via the sidebar
            // re-parses the page from a stale tsxContent (the snapshot
            // captured at project open) and any edits since then disappear.
            flushPendingPageWrite();
            persistActiveSource();
            onProjectChange?.((prev) => ({
                ...prev,
                pages: [...prev.pages, newPage],
            }));
            setActivePageName(newPage.name);
            resetPageEdit();
        }
        catch (e) {
            setPageEditError(errorMessage(e));
            setPageEditBusy(false);
        }
    };
    const handleDuplicatePage = async (sourcePageName, newName) => {
        setPageEditBusy(true);
        setPageEditError(null);
        try {
            const newPage = await window.scamp.duplicatePage({
                projectPath: project.path,
                sourcePageName,
                newPageName: newName,
            });
            onProjectChange?.({
                ...project,
                pages: [...project.pages, newPage],
            });
            setActivePageName(newPage.name);
            resetPageEdit();
        }
        catch (e) {
            setPageEditError(errorMessage(e));
            setPageEditBusy(false);
        }
    };
    const handleRenamePage = async (oldName, newName) => {
        setPageEditBusy(true);
        setPageEditError(null);
        try {
            // Ensure any pending debounced write lands on the OLD files
            // before the rename swaps them out from under us.
            flushPendingPageWrite();
            // Capture the old tsxPath so we can rekey the history bucket
            // after the rename. The page's path changes (the file moves on
            // disk), so without rekey the in-session history would be
            // stranded under the old key and lost.
            const oldTsxPath = project.pages.find((p) => p.name === oldName)?.tsxPath;
            const newPage = await window.scamp.renamePage({
                projectPath: project.path,
                oldPageName: oldName,
                newPageName: newName,
            });
            const nextPages = project.pages.map((p) => p.name === oldName ? newPage : p);
            onProjectChange?.({ ...project, pages: nextPages });
            if (activePageName === oldName) {
                setActivePageName(newPage.name);
            }
            // Move the history bucket to the new tsxPath, then push a
            // `rename-page` entry. The entry lives in the (now renamed)
            // page's bucket so undoing it surfaces the pre-rename state.
            if (oldTsxPath) {
                useHistoryStore.getState().rekeyPage(oldTsxPath, newPage.tsxPath);
            }
            useHistoryStore.getState().commitHistory({
                kind: 'rename-page',
                previousName: oldName,
                pageName: newName,
            }, useCanvasStore.getState().elements);
            resetPageEdit();
        }
        catch (e) {
            setPageEditError(errorMessage(e));
            setPageEditBusy(false);
        }
    };
    const handleDeletePage = async (name) => {
        setDeletePageError(null);
        try {
            await window.scamp.deletePage({ projectPath: project.path, pageName: name });
            const nextPages = project.pages.filter((p) => p.name !== name);
            onProjectChange?.({ ...project, pages: nextPages });
            if (activePageName === name) {
                setActivePageName(nextPages[0]?.name ?? null);
            }
            setDeletingPageName(null);
        }
        catch (e) {
            // Surface the failure inline in the confirm dialog and keep it
            // open so the user can retry — mirrors create/rename handling.
            setDeletePageError(errorMessage(e));
        }
    };
    // ---- Components ----
    /**
     * Atomic add: create the component on disk, append to the
     * project list, and immediately enter its editor. PascalCase
     * validation happens main-side too; this rejects locally first
     * so users see invalid-name errors without an IPC round trip.
     */
    const handleAddComponent = async (name) => {
        setCreatingComponent(true);
        setComponentEditError(null);
        try {
            const created = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: name,
            });
            // Functional updater so this composes with `openComponent`'s
            // follow-on `persistActiveSource` if the outgoing page has
            // unsaved edits — otherwise the second setProject would
            // clobber the new component out of `project.components`.
            onProjectChange?.((prev) => ({
                ...prev,
                components: [...prev.components, created],
            }));
            setComponentEdit(null);
            openComponent(created.name, null);
        }
        catch (e) {
            setComponentEditError(errorMessage(e));
        }
        finally {
            setCreatingComponent(false);
        }
    };
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
    // Phase 7: component-sidebar context menu (right-click) +
    // delete-component flow. Holds the menu coords + target name
    // while open; cleared on dismiss.
    const [componentMenu, setComponentMenu] = useState(null);
    const [deletingComponent, setDeletingComponent] = useState(null);
    const [componentDeleteBusy, setComponentDeleteBusy] = useState(false);
    const openComponentMenu = (e, componentName) => {
        e.preventDefault();
        e.stopPropagation();
        setComponentMenu({ x: e.clientX, y: e.clientY, componentName });
    };
    const requestDeleteComponent = (componentName) => {
        const usages = findInstanceUsagesAcrossPages(project.pages, componentName);
        setDeletingComponent({
            componentName,
            impactByPage: groupUsagesByPage(usages),
        });
    };
    /** see docs/notes/components-multi-file-ops.md — Delete-component */
    const handleConfirmDeleteComponent = async () => {
        if (!deletingComponent)
            return;
        const { componentName } = deletingComponent;
        setComponentDeleteBusy(true);
        armTargetSwapSuppression();
        try {
            const breakpoints = useCanvasStore.getState().breakpoints;
            const updatedPages = [];
            for (const page of project.pages) {
                const parsed = parseCode(page.tsxContent, page.cssContent, {
                    breakpoints,
                });
                const toRemove = new Set();
                for (const el of Object.values(parsed.elements)) {
                    if (el.type === 'component-instance' && el.componentName === componentName) {
                        toRemove.add(el.id);
                    }
                }
                if (toRemove.size === 0) {
                    updatedPages.push(page);
                    continue;
                }
                const nextElements = {};
                for (const [id, el] of Object.entries(parsed.elements)) {
                    if (toRemove.has(id))
                        continue;
                    nextElements[id] = {
                        ...el,
                        childIds: el.childIds.filter((c) => !toRemove.has(c)),
                    };
                }
                const rewritten = generateCode({
                    elements: nextElements,
                    rootId: parsed.rootId,
                    pageName: page.name,
                    breakpoints,
                    customMediaBlocks: parsed.customMediaBlocks,
                    pageKeyframesBlocks: parsed.keyframesBlocks,
                    cssModuleImportName: project.format === 'nextjs' ? 'page' : page.name,
                });
                await window.scamp.writeFile({
                    tsxPath: page.tsxPath,
                    cssPath: page.cssPath,
                    tsxContent: rewritten.tsx,
                    cssContent: rewritten.css,
                });
                updatedPages.push({
                    ...page,
                    tsxContent: rewritten.tsx,
                    cssContent: rewritten.css,
                });
            }
            // Folder removal AFTER page rewrites so imports don't dangle.
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName,
            });
            const wasEditingDeleted = activeComponent !== null && activeComponent.name === componentName;
            if (wasEditingDeleted) {
                setActiveComponentState(null);
            }
            onProjectChange?.({
                ...project,
                pages: updatedPages,
                components: project.components.filter((c) => c.name !== componentName),
            });
            setDeletingComponent(null);
        }
        catch (err) {
            disarmTargetSwapSuppression();
            const message = errorMessage(err);
            useAppLogStore
                .getState()
                .log('warn', `Delete component "${componentName}" failed: ${message}`);
        }
        finally {
            setComponentDeleteBusy(false);
        }
    };
    /** see docs/notes/components-multi-file-ops.md — Rename-component */
    const handleRenameComponent = async (oldName, newName) => {
        if (oldName === newName) {
            setComponentEdit(null);
            return;
        }
        setRenamingComponent(true);
        setComponentEditError(null);
        armTargetSwapSuppression();
        try {
            flushPendingPageWrite();
            persistActiveSource();
            const breakpoints = useCanvasStore.getState().breakpoints;
            const sourceComponent = project.components.find((c) => c.name === oldName);
            if (!sourceComponent) {
                throw new Error(`Component "${oldName}" not found in project.`);
            }
            const newContent = rewriteComponentForRename(sourceComponent.tsxContent, sourceComponent.cssContent, oldName, newName, { breakpoints });
            // Skip pages that don't reference oldName — keeps them byte-stable.
            const rewrittenPages = [];
            const unchangedPages = [];
            for (const page of project.pages) {
                const result = rewritePageForComponentRename(page.tsxContent, page.cssContent, oldName, newName, page.name, project.format, { breakpoints });
                if (result.changed) {
                    rewrittenPages.push({
                        file: page,
                        tsx: result.tsx,
                        css: result.css,
                    });
                }
                else {
                    unchangedPages.push(page);
                }
            }
            const newComponentFile = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: newName,
                tsxContent: newContent.tsx,
                cssContent: newContent.css,
            });
            for (const entry of rewrittenPages) {
                await window.scamp.writeFile({
                    tsxPath: entry.file.tsxPath,
                    cssPath: entry.file.cssPath,
                    tsxContent: entry.tsx,
                    cssContent: entry.css,
                });
            }
            // Old folder removed last so page imports don't dangle.
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName: oldName,
            });
            const nextComponents = project.components.map((c) => c.name === oldName ? newComponentFile : c);
            const nextPages = [
                ...unchangedPages,
                ...rewrittenPages.map((e) => ({
                    ...e.file,
                    tsxContent: e.tsx,
                    cssContent: e.css,
                })),
            ];
            // Preserve original page order so the sidebar doesn't reshuffle.
            const orderedPages = project.pages.map((p) => {
                const rewritten = rewrittenPages.find((e) => e.file.name === p.name);
                if (rewritten) {
                    return {
                        ...p,
                        tsxContent: rewritten.tsx,
                        cssContent: rewritten.css,
                    };
                }
                return p;
            });
            void nextPages; // keep types tidy when the ordered variant wins below
            onProjectChange?.({
                ...project,
                components: nextComponents,
                pages: orderedPages,
            });
            if (activeComponent !== null && activeComponent.name === oldName) {
                setActiveComponentState({
                    name: newName,
                    returnToPage: activeComponent.returnToPage,
                });
            }
            // Keep active page's in-memory componentName fields consistent.
            useCanvasStore.getState().renameComponentReferences(oldName, newName);
            setComponentEdit(null);
        }
        catch (err) {
            disarmTargetSwapSuppression();
            const message = errorMessage(err);
            setComponentEditError(message);
            useAppLogStore
                .getState()
                .log('warn', `Rename component "${oldName}" → "${newName}" failed: ${message}`);
        }
        finally {
            setRenamingComponent(false);
        }
    };
    const openPageMenu = (e, pageName) => {
        e.preventDefault();
        e.stopPropagation();
        setPageMenu({ x: e.clientX, y: e.clientY, pageName });
    };
    const buildMenuItems = (pageName) => [
        {
            label: 'Rename',
            onSelect: () => {
                setPageEditError(null);
                setPageEdit({ rename: pageName });
            },
        },
        {
            label: 'Duplicate',
            onSelect: () => {
                setPageEditError(null);
                setPageEdit({ duplicate: pageName });
            },
        },
        {
            label: 'Delete',
            destructive: true,
            disabled: project.pages.length <= 1,
            onSelect: () => setDeletingPageName(pageName),
        },
    ];
    const isEditingPage = pageEdit !== null;
    // Local binding so the `!== null` guard narrows it for the dialog's
    // onConfirm closure (a property access wouldn't narrow).
    const convertElementId = instanceFlows.convertElementId;
    return (_jsxs("div", { className: styles.shell, children: [_jsx(ProjectHeader, { projectName: project.name, bottomPanel: bottomPanel, canPreview: canPreview, projectFormat: projectFormatForPreview, onClose: onClose, onToggleCode: toggleCodePanel, onToggleTerminal: toggleTerminalPanel, onOpenPreview: openPreview }), _jsx(SaveStatusToast, {}), showMigrationBanner && (_jsx(MigrationBanner, { onDismiss: handleDismissMigrationBanner })), parseError && (_jsx(ParseErrorBanner, { targetName: parseError.targetName, onDismiss: clearParseError })), project.format === 'legacy' && !projectConfig.nextjsMigrationDismissed && (_jsx(NextjsMigrationBanner, { project: project, onMigrated: (next) => {
                    // Project flips to nextjs format — refresh upward and pick
                    // the home page so the renderer doesn't try to render a
                    // page whose paths just changed under it.
                    onProjectChange?.(next);
                    setActivePageName(next.pages[0]?.name ?? null);
                }, onDismiss: () => handleProjectConfigChange({
                    ...projectConfig,
                    nextjsMigrationDismissed: true,
                }) })), _jsxs("div", { className: styles.body, children: [_jsxs("aside", { className: styles.sidebar, children: [_jsxs("div", { className: styles.sidebarTabStrip, role: "tablist", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": leftSidebarTab === 'layers', className: `${styles.sidebarTab} ${leftSidebarTab === 'layers' ? styles.sidebarTabActive : ''}`, onClick: () => setLeftSidebarTab('layers'), children: "Pages & Layers" }), _jsx("button", { type: "button", role: "tab", "aria-selected": leftSidebarTab === 'history', className: `${styles.sidebarTab} ${leftSidebarTab === 'history' ? styles.sidebarTabActive : ''}`, onClick: () => setLeftSidebarTab('history'), children: "History" })] }), leftSidebarTab === 'history' && _jsx(HistoryPanel, {}), leftSidebarTab === 'layers' && _jsxs(_Fragment, { children: [_jsxs("div", { className: styles.sidebarSection, children: [_jsx("h2", { className: styles.sidebarTitle, children: "Pages" }), _jsxs("ul", { className: styles.pageList, children: [project.pages.map((page) => {
                                                        const isDuplicating = pageEdit !== null &&
                                                            pageEdit !== 'new' &&
                                                            'duplicate' in pageEdit &&
                                                            pageEdit.duplicate === page.name;
                                                        const isRenaming = pageEdit !== null &&
                                                            pageEdit !== 'new' &&
                                                            'rename' in pageEdit &&
                                                            pageEdit.rename === page.name;
                                                        if (isDuplicating) {
                                                            // Seed with `[name]-copy` and select just the "-copy"
                                                            // portion so the user can retype it instantly.
                                                            const seed = `${page.name}-copy`;
                                                            return (_jsx("li", { children: _jsx(PageNameInput, { initialValue: seed, existingNames: existingPageNames, selectRange: [page.name.length, seed.length], onConfirm: (name) => void handleDuplicatePage(page.name, name), onCancel: resetPageEdit, error: pageEditError, busy: pageEditBusy }) }, page.name));
                                                        }
                                                        if (isRenaming) {
                                                            // Exclude the current name from collision checks so
                                                            // "rename home → home" surfaces as an explicit no-op
                                                            // from the IPC rather than as a spurious collision.
                                                            const otherNames = existingPageNames.filter((n) => n !== page.name);
                                                            return (_jsx("li", { children: _jsx(PageNameInput, { initialValue: page.name, existingNames: otherNames, onConfirm: (name) => void handleRenamePage(page.name, name), onCancel: resetPageEdit, error: pageEditError, busy: pageEditBusy }) }, page.name));
                                                        }
                                                        return (_jsx("li", { children: _jsx("button", { className: `${styles.pageButton} ${activeComponent === null &&
                                                                    activePageName === page.name
                                                                    ? styles.pageActive
                                                                    : ''}`, onClick: () => {
                                                                    if (isEditingPage)
                                                                        return;
                                                                    // Clicking the same page that's already
                                                                    // active is a no-op for state but we
                                                                    // still want to keep the early-return so
                                                                    // we don't pointlessly thrash the project
                                                                    // snapshot.
                                                                    const sameTargetClicked = activeComponent === null &&
                                                                        activePageName === page.name;
                                                                    if (sameTargetClicked)
                                                                        return;
                                                                    // Flush any in-flight write on the
                                                                    // outgoing target (component or other
                                                                    // page) BEFORE swapping so the disk has
                                                                    // the user's latest edits. Then persist
                                                                    // those edits into the React snapshot so
                                                                    // re-entering the outgoing target later
                                                                    // shows the work, not the stale
                                                                    // initial-load template.
                                                                    flushPendingPageWrite();
                                                                    persistActiveSource();
                                                                    if (activeComponent !== null) {
                                                                        setActiveComponentState(null);
                                                                    }
                                                                    setActivePageName(page.name);
                                                                }, onContextMenu: (e) => openPageMenu(e, page.name), type: "button", children: page.name }) }, page.name));
                                                    }), pageEdit === 'new' && (_jsx("li", { children: _jsx(PageNameInput, { existingNames: existingPageNames, onConfirm: (name) => void handleAddPage(name), onCancel: resetPageEdit, error: pageEditError, busy: pageEditBusy }) }))] }), pageEdit !== 'new' && (_jsx("button", { className: styles.addPageButton, onClick: () => {
                                                    if (isEditingPage)
                                                        return;
                                                    setPageEditError(null);
                                                    setPageEdit('new');
                                                }, type: "button", children: "+ Add Page" }))] }), _jsxs("div", { className: styles.sidebarSection, children: [_jsx("h2", { className: styles.sidebarTitle, children: "Components" }), _jsxs("ul", { className: styles.pageList, children: [project.components.map((component) => {
                                                        const isRenaming = componentEdit !== null &&
                                                            componentEdit !== 'new' &&
                                                            componentEdit.rename === component.name;
                                                        if (isRenaming) {
                                                            return (_jsx("li", { children: _jsx(ComponentNameInput, { initialValue: component.name, existingNames: project.components
                                                                        .map((c) => c.name)
                                                                        .filter((n) => n !== component.name), onConfirm: (name) => void handleRenameComponent(component.name, name), onCancel: () => {
                                                                        if (renamingComponent)
                                                                            return;
                                                                        setComponentEdit(null);
                                                                        setComponentEditError(null);
                                                                    }, error: componentEditError, busy: renamingComponent }) }, component.name));
                                                        }
                                                        return (_jsx("li", { children: _jsx(ComponentSidebarItem, { componentName: component.name, projectPath: project.path, isActive: activeComponent?.name === component.name, onClick: () => openComponent(component.name, null), onContextMenu: (e) => openComponentMenu(e, component.name), 
                                                                // HTML5 DnD source: dragging a component onto
                                                                // the canvas inserts an instance there. The
                                                                // Viewport's drop handler reads this
                                                                // dataTransfer mime to distinguish a
                                                                // component-drag from any other drag.
                                                                onDragStart: (e) => {
                                                                    e.dataTransfer.setData('application/x-scamp-component', component.name);
                                                                    e.dataTransfer.effectAllowed = 'copy';
                                                                } }) }, component.name));
                                                    }), componentEdit === 'new' && (_jsx("li", { children: _jsx(ComponentNameInput, { existingNames: project.components.map((c) => c.name), onConfirm: (name) => void handleAddComponent(name), onCancel: () => {
                                                                setComponentEdit(null);
                                                                setComponentEditError(null);
                                                            }, error: componentEditError, busy: creatingComponent }) }))] }), componentEdit === null && (_jsx("button", { className: styles.addPageButton, onClick: () => {
                                                    setComponentEditError(null);
                                                    setComponentEdit('new');
                                                }, type: "button", children: "+ Add Component" }))] }), _jsxs("div", { className: `${styles.sidebarSection} ${styles.sidebarLayers}`, "data-testid": "layers-panel", children: [_jsx("h2", { className: styles.sidebarTitle, children: "Layers" }), _jsx(ElementTree, {})] })] })] }), _jsx(CanvasArea, { activeComponent: activeComponent, activePageName: activePageName, projectConfig: projectConfig, artboardScrollRef: artboardScrollRef, onProjectConfigChange: handleProjectConfigChange, onExitComponentEditor: exitComponentEditor, onOpenSettings: () => setShowProjectSettings(true), onOpenTheme: () => setShowThemePanel(true) }), _jsx(PropertiesPanel, {})] }), bottomPanel === 'code' && _jsx(CodePanel, {}), terminalEverOpened && (_jsx(TerminalPanel, { cwd: project.path, hidden: bottomPanel !== 'terminal' }, project.path)), showThemePanel && (_jsx(ThemePanel, { projectPath: project.path, onClose: () => setShowThemePanel(false) })), showProjectSettings && (_jsx(ProjectSettingsPage, { projectName: project.name, projectPath: project.path, config: projectConfig, onChange: handleProjectConfigChange, onBack: () => setShowProjectSettings(false) })), pageMenu && (_jsx(PageContextMenu, { x: pageMenu.x, y: pageMenu.y, items: buildMenuItems(pageMenu.pageName), onClose: () => setPageMenu(null) })), componentMenu && (_jsx(PageContextMenu, { x: componentMenu.x, y: componentMenu.y, items: [
                    {
                        label: 'Rename…',
                        onSelect: () => {
                            setComponentEditError(null);
                            setComponentEdit({ rename: componentMenu.componentName });
                        },
                    },
                    {
                        label: 'Delete component…',
                        destructive: true,
                        onSelect: () => requestDeleteComponent(componentMenu.componentName),
                    },
                ], onClose: () => setComponentMenu(null) })), _jsx(ElementContextMenu, {}), deletingPageName && (_jsx(ConfirmDialog, { title: `Delete page "${deletingPageName}"?`, message: `This will remove ${deletingPageName}.tsx and ${deletingPageName}.module.css from your project folder. This cannot be undone.`, confirmLabel: "Delete", cancelLabel: "Cancel", variant: "destructive", error: deletePageError, onConfirm: () => void handleDeletePage(deletingPageName), onCancel: () => {
                    setDeletingPageName(null);
                    setDeletePageError(null);
                } })), convertElementId !== null && (_jsx(CreateComponentDialog, { existingNames: project.components.map((c) => c.name), error: instanceFlows.convertError, busy: instanceFlows.convertingComponent, onConfirm: (name) => void instanceFlows.handleConvertToComponent(convertElementId, name), onCancel: instanceFlows.cancelConvert })), instanceFlows.lockPropRequest !== null && (_jsx(ConfirmDialog, { title: `Lock "${instanceFlows.lockPropRequest.propName}"?`, message: `This will drop the override on ${instanceFlows.lockPropRequest.impactByPage
                    .map((g) => `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`)
                    .join(', ')}. The component-side default will render in their place.`, confirmLabel: "Lock prop", variant: "destructive", onConfirm: instanceFlows.handleConfirmLockProp, onCancel: instanceFlows.cancelLockProp })), deletingComponent !== null && (_jsx(ConfirmDialog, { title: `Delete component "${deletingComponent.componentName}"?`, message: deletingComponent.impactByPage.length === 0
                    ? `Removes the components/${deletingComponent.componentName}/ folder. No instances on any page.`
                    : `Removes the components/${deletingComponent.componentName}/ folder AND every instance from: ${deletingComponent.impactByPage
                        .map((g) => `${g.pageName} (${g.count} instance${g.count === 1 ? '' : 's'})`)
                        .join(', ')}. This cannot be undone.`, confirmLabel: componentDeleteBusy ? 'Deleting…' : 'Delete component', variant: "destructive", onConfirm: () => void handleConfirmDeleteComponent(), onCancel: () => {
                    if (componentDeleteBusy)
                        return;
                    setDeletingComponent(null);
                } })), instanceFlows.deletePropTextRequest !== null && (_jsx(ConfirmDialog, { title: instanceFlows.deletePropTextRequest.propsAtRisk.length === 1
                    ? `Delete prop "${instanceFlows.deletePropTextRequest.propsAtRisk[0]}"?`
                    : 'Delete prop text elements?', message: `Existing overrides on ${instanceFlows.deletePropTextRequest.impactByPage
                    .map((g) => `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`)
                    .join(', ')} will no longer have an effect. The pages keep the attribute on disk until they re-save.`, confirmLabel: "Delete", variant: "destructive", onConfirm: instanceFlows.handleConfirmDeletePropText, onCancel: instanceFlows.cancelDeletePropText })), instanceFlows.detachRequest !== null && (_jsx(ConfirmDialog, { title: `Detach ${instanceFlows.detachRequest.componentName} instance?`, message: instanceFlows.detachRequest.overrideCount > 0
                    ? `The component's design will be copied directly into this page. Future edits to ${instanceFlows.detachRequest.componentName} won't update this copy. Your ${instanceFlows.detachRequest.overrideCount} override${instanceFlows.detachRequest.overrideCount === 1 ? '' : 's'} will be baked in as literal text. This cannot be undone with re-attach.`
                    : `The component's design will be copied directly into this page. Future edits to ${instanceFlows.detachRequest.componentName} won't update this copy. This cannot be undone with re-attach.`, confirmLabel: "Detach", variant: "destructive", onConfirm: instanceFlows.handleConfirmDetach, onCancel: instanceFlows.cancelDetach }))] }));
};
