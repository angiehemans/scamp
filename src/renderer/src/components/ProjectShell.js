import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState, } from 'react';
import { IconCode, IconPlayerPlay, IconTerminal2, } from '@tabler/icons-react';
import { DEFAULT_COMPONENT_CANVAS_SIZE, DEFAULT_PROJECT_CONFIG, } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { useAppLogStore } from '@store/appLogSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { armTargetSwapSuppression, disarmTargetSwapSuppression, flushPendingPageWrite, } from '../syncBridge';
import { parseThemeFile } from '@lib/parseTheme';
import { parseGoogleFontsEmbed } from '@lib/googleFontsEmbed';
import { useFontsStore } from '@store/fontsSlice';
import { clampToParent } from '@lib/bounds';
import { Viewport } from '../canvas/Viewport';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { CodePanel } from './CodePanel';
import { TerminalPanel } from './TerminalPanel';
import { ElementTree } from './ElementTree';
import { HistoryPanel } from './HistoryPanel';
import { ThemePanel } from './ThemePanel';
import { ZoomControls } from './ZoomControls';
import { CanvasSizeControl } from './CanvasSizeControl';
import { MigrationBanner } from './MigrationBanner';
import { NextjsMigrationBanner } from './NextjsMigrationBanner';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { Tooltip } from './controls/Tooltip';
import { PageNameInput } from './PageNameInput';
import { ComponentNameInput } from './ComponentNameInput';
import { PageContextMenu } from './PageContextMenu';
import { CONVERT_TO_COMPONENT_EVENT, DETACH_INSTANCE_EVENT, ElementContextMenu, } from './ElementContextMenu';
import { CreateComponentDialog } from './CreateComponentDialog';
import { ComponentSidebarItem } from './ComponentSidebarItem';
import { REQUEST_LOCK_PROP_EVENT, } from './DataPanel';
import { generateComponentFromSubtree } from '@lib/extractComponent';
import { filterUsagesWithPropOverride, findInstanceUsagesAcrossPages, groupUsagesByPage, } from '@lib/componentUsage';
import { rewriteComponentForRename, rewritePageForComponentRename, } from '@lib/componentRename';
import { ConfirmDialog } from './ConfirmDialog';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import styles from './ProjectShell.module.css';
export const ProjectShell = ({ project, onClose, onProjectChange, }) => {
    const [activePageName, setActivePageName] = useState(project.pages[0]?.name ?? null);
    // The component currently being edited, when the canvas is in
    // the component editor instead of the page editor. Mutually
    // exclusive with `activePageName` — opening one clears the other.
    // The optional `returnToPage` field records which page (if any)
    // the user entered the component from so Esc / breadcrumb-click
    // can put them back where they were. For Phase 2 the user only
    // enters from the sidebar list, so this stays null in practice.
    const [activeComponent, setActiveComponentState] = useState(null);
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
    // Per-project config loaded from scamp.config.json. Default values
    // render immediately so the canvas doesn't flash a wrong background
    // while the first read is in flight.
    const [projectConfig, setProjectConfig] = useState(DEFAULT_PROJECT_CONFIG);
    const [showProjectSettings, setShowProjectSettings] = useState(false);
    // Set true when parseCode detected the legacy root three-tuple on
    // any page load in this session. Cleared when the user dismisses
    // the banner (which also persists `canvasMigrationAcknowledged` to
    // scamp.config.json so the banner never reappears).
    const [showMigrationBanner, setShowMigrationBanner] = useState(false);
    // Ref to the artboard scroll container. Passed to `Viewport` so
    // fit-to-width zoom can observe the real scroll area, and used here
    // for the click-to-deselect handler on empty canvas space.
    const artboardScrollRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const next = await window.scamp.readProjectConfig({
                projectPath: project.path,
            });
            if (!cancelled)
                setProjectConfig(next);
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [project.path]);
    const handleProjectConfigChange = useCallback((next) => {
        setProjectConfig(next);
        void window.scamp.writeProjectConfig({
            projectPath: project.path,
            config: next,
        });
    }, [project.path]);
    // Mirror the project's breakpoint table into the canvas store so
    // deeply-nested components (ElementRenderer, cascaded styles) can
    // read it without prop drilling.
    useEffect(() => {
        useCanvasStore.getState().setBreakpoints(projectConfig.breakpoints);
    }, [projectConfig.breakpoints]);
    // Mirror the project format so the sync bridge can pick the right
    // CSS-module import basename when emitting code.
    useEffect(() => {
        useCanvasStore.getState().setProjectFormat(project.format);
    }, [project.format]);
    // Mirror the project root path so deeply-nested components don't
    // have to walk up from `activePage.tsxPath` (which gets the wrong
    // answer for nested nextjs page folders).
    useEffect(() => {
        useCanvasStore.getState().setProjectPath(project.path);
    }, [project.path]);
    // Mirror the project's page list so the Link section's destination
    // dropdown and the canvas link indicator's broken-link check have
    // a fast lookup without prop drilling.
    useEffect(() => {
        useCanvasStore.getState().setPageNames(project.pages.map((p) => p.name));
    }, [project.pages]);
    // Parse every component's TSX/CSS into an element tree and push
    // the result into the canvas store's componentTrees cache. The
    // renderer reads from there when it hits a `component-instance`
    // element on a page. Re-runs on every `project.components`
    // reference change so component edits (via the editor OR an
    // external agent) propagate live to every instance on every
    // page without per-page work.
    useEffect(() => {
        const trees = {};
        for (const component of project.components) {
            try {
                const parsed = parseCode(component.tsxContent, component.cssContent, {
                    breakpoints: projectConfig.breakpoints,
                });
                trees[component.name] = {
                    elements: parsed.elements,
                    rootId: parsed.rootId,
                };
            }
            catch (err) {
                // Skip the component — its instances will render as
                // missing-component placeholders. Log so the dev console
                // surfaces the parse failure.
                console.error('[ProjectShell] parseCode failed for component', component.name, err);
            }
        }
        useCanvasStore.getState().setComponentTrees(trees);
    }, [project.components, projectConfig.breakpoints]);
    // Keep the canvas min-height in sync with the active target.
    // Page editor: 900 (matches EMPTY_FRAME_MIN_HEIGHT — the empty-
    // page canvas baseline). Component editor: the user-configured
    // `componentCanvas[name].height` (or its default fallback).
    // The root element's render branch reads from this, so the
    // root fills the visible canvas frame regardless of content
    // size, and clicks on "empty" canvas area still hit the root.
    useEffect(() => {
        const next = activeComponent !== null
            ? (projectConfig.componentCanvas?.[activeComponent.name]?.height ??
                DEFAULT_COMPONENT_CANVAS_SIZE.height)
            : 900;
        useCanvasStore.getState().setCanvasMinHeight(next);
    }, [activeComponent, projectConfig.componentCanvas]);
    // Consume page-navigation requests from the canvas link indicator.
    // The store holds a one-shot pending navigation; we route it through
    // the same setActivePageName flow the sidebar uses, then clear.
    const pendingPageNavigation = useCanvasStore((s) => s.pendingPageNavigation);
    useEffect(() => {
        if (pendingPageNavigation === null)
            return;
        if (project.pages.some((p) => p.name === pendingPageNavigation)) {
            setActivePageName(pendingPageNavigation);
        }
        useCanvasStore.getState().requestPageNavigation(null);
    }, [pendingPageNavigation, project.pages]);
    // Same one-shot mechanism for the canvas → component-editor
    // navigation: double-clicking a component instance on the page
    // canvas sets this field, and we route it through the same
    // `openComponent` flow the sidebar uses. The instance's host
    // page becomes the `returnToPage`, so the breadcrumb and Esc
    // can return there.
    const pendingComponentNavigation = useCanvasStore((s) => s.pendingComponentNavigation);
    useEffect(() => {
        if (pendingComponentNavigation === null)
            return;
        if (project.components.some((c) => c.name === pendingComponentNavigation)) {
            openComponent(pendingComponentNavigation, activePageName);
        }
        useCanvasStore.getState().requestComponentNavigation(null);
        // openComponent + activePageName are intentionally not in the
        // dep array — we only want this to fire when pendingComponent-
        // Navigation flips. Stable references via the store's getState()
        // mean stale-closure reads are safe.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingComponentNavigation, project.components]);
    const loadPage = useCanvasStore((s) => s.loadPage);
    const loadComponent = useCanvasStore((s) => s.loadComponent);
    const resetForNewPage = useCanvasStore((s) => s.resetForNewPage);
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
    // Keep a `<link rel="stylesheet">` per project font URL in
    // `document.head` so the canvas preview actually loads the
    // referenced Google Fonts stylesheet. Reconciles on delta: unchanged
    // URLs keep their tag (and the browser's cached stylesheet) across
    // renders.
    const projectFontUrls = useFontsStore((s) => s.projectFontUrls);
    useEffect(() => {
        const ATTR = 'data-scamp-font-import';
        const existing = new Map();
        document
            .querySelectorAll(`link[${ATTR}]`)
            .forEach((el) => {
            const u = el.getAttribute(ATTR);
            if (u)
                existing.set(u, el);
        });
        const wanted = new Set(projectFontUrls);
        for (const [url, el] of existing) {
            if (!wanted.has(url))
                el.remove();
        }
        for (const url of projectFontUrls) {
            if (existing.has(url))
                continue;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.setAttribute(ATTR, url);
            document.head.appendChild(link);
        }
    }, [projectFontUrls]);
    // On ProjectShell unmount (project closed) strip every injected tag
    // so a different project doesn't inherit this one's fonts.
    useEffect(() => {
        return () => {
            document
                .querySelectorAll(`link[data-scamp-font-import]`)
                .forEach((el) => el.remove());
        };
    }, []);
    // Load theme tokens + font imports from theme.css on project open.
    useEffect(() => {
        const loadTheme = async () => {
            const content = await window.scamp.readTheme({ projectPath: project.path });
            const parsed = parseThemeFile(content);
            useCanvasStore.getState().setThemeTokens(parsed.tokens);
            // Derive family names from the import URLs — re-parsing the URL
            // is cheap and keeps the URL as the single source of truth.
            const families = parsed.fontImportUrls.flatMap((url) => {
                const result = parseGoogleFontsEmbed(url);
                return result.ok ? result.value.families : [];
            });
            useFontsStore.getState().setProjectFonts({
                families,
                urls: parsed.fontImportUrls,
            });
        };
        void loadTheme();
        return () => {
            // Clear when the project unmounts so a stale project's fonts
            // don't linger in the picker.
            useFontsStore.getState().setProjectFonts({ families: [], urls: [] });
        };
    }, [project.path]);
    // Parse + load the selected page whenever it changes. The store's
    // sync bridge handles writes back to disk on canvas edits.
    // Skipped when the user has entered the component editor —
    // `activeComponent` takes precedence and a sibling effect below
    // loads that target instead.
    useEffect(() => {
        if (activeComponent !== null)
            return;
        if (!activePageName) {
            resetForNewPage();
            return;
        }
        const page = project.pages.find((p) => p.name === activePageName);
        if (!page) {
            resetForNewPage();
            return;
        }
        let parsed;
        try {
            parsed = parseCode(page.tsxContent, page.cssContent, {
                breakpoints: projectConfig.breakpoints,
            });
        }
        catch (err) {
            console.error('[ProjectShell] parseCode failed for', page.name, err);
            resetForNewPage();
            return;
        }
        // Surface the one-time migration banner when the parser had to
        // strip the legacy root sizing three-tuple. Skipped when the user
        // has already dismissed it on a prior open of this project.
        if (parsed.migrated && !projectConfig.canvasMigrationAcknowledged) {
            setShowMigrationBanner(true);
        }
        loadPage({ name: page.name, tsxPath: page.tsxPath, cssPath: page.cssPath }, parsed.elements, { tsx: page.tsxContent, css: page.cssContent }, parsed.customMediaBlocks, parsed.keyframesBlocks, parsed.cssDuplicates);
        // Per-page history persists across page switches — `loadPage`
        // activates this page's bucket in the history slice. Don't
        // clear here; switching back to this page should restore its
        // stack.
    }, [
        activeComponent,
        activePageName,
        project.pages,
        loadPage,
        resetForNewPage,
        projectConfig.canvasMigrationAcknowledged,
    ]);
    // Parse + load the active component whenever it changes. Mirror
    // of the page-load effect above — component editor reuses every
    // canvas / panel / history primitive unchanged.
    useEffect(() => {
        if (activeComponent === null)
            return;
        const component = project.components.find((c) => c.name === activeComponent.name);
        if (!component) {
            // The component disappeared from disk while we had it open
            // (rename / delete from outside Scamp). Fall back to a clean
            // canvas — the sidebar will refresh on the next pages-changed
            // event and the user can re-open whatever's still there.
            setActiveComponentState(null);
            resetForNewPage();
            return;
        }
        let parsed;
        try {
            parsed = parseCode(component.tsxContent, component.cssContent, {
                breakpoints: projectConfig.breakpoints,
            });
        }
        catch (err) {
            console.error('[ProjectShell] parseCode failed for component', component.name, err);
            resetForNewPage();
            return;
        }
        loadComponent({
            name: component.name,
            tsxPath: component.tsxPath,
            cssPath: component.cssPath,
        }, parsed.elements, { tsx: component.tsxContent, css: component.cssContent }, parsed.customMediaBlocks, parsed.keyframesBlocks, parsed.cssDuplicates);
    }, [
        activeComponent,
        project.components,
        loadComponent,
        resetForNewPage,
        projectConfig.canvasMigrationAcknowledged,
    ]);
    const handleDismissMigrationBanner = useCallback(() => {
        setShowMigrationBanner(false);
        handleProjectConfigChange({
            ...projectConfig,
            canvasMigrationAcknowledged: true,
        });
    }, [projectConfig, handleProjectConfigChange]);
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
        });
    }, [canPreview, projectPathForPreview, activePageName]);
    // Global keyboard shortcuts. We deliberately read store state inside the
    // handler (rather than via React state captured in deps) so the listener
    // can stay attached for the lifetime of the component.
    useEffect(() => {
        const isEditableTarget = (target) => {
            if (!(target instanceof HTMLElement))
                return false;
            if (target.isContentEditable)
                return true;
            const tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        };
        const handleKey = (e) => {
            // Ctrl+` / Cmd+` — toggle the terminal (matches VS Code).
            if ((e.metaKey || e.ctrlKey) && e.key === '`') {
                e.preventDefault();
                toggleTerminalPanel();
                return;
            }
            // Cmd/Ctrl+P — open the preview window.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                if (canPreview)
                    openPreview();
                return;
            }
            // Cmd/Ctrl+= or Cmd/Ctrl++ — zoom canvas in. We accept both because
            // the unshifted "+" key actually emits "=" on US keyboards, while
            // shifted versions (or non-US layouts) emit "+".
            if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                useCanvasStore.getState().zoomIn();
                return;
            }
            // Cmd/Ctrl+- — zoom canvas out.
            if ((e.metaKey || e.ctrlKey) && e.key === '-') {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                useCanvasStore.getState().zoomOut();
                return;
            }
            // Cmd/Ctrl+0 — reset canvas zoom (back to fit-to-container).
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                useCanvasStore.getState().resetZoom();
                return;
            }
            // Shift+Cmd/Ctrl+G — ungroup the selected element. We check this
            // BEFORE the plain Cmd+G branch so the shift modifier wins.
            if ((e.metaKey || e.ctrlKey) &&
                e.shiftKey &&
                (e.key === 'g' || e.key === 'G')) {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                const target = state.selectedElementIds[0];
                if (!target)
                    return;
                if (state.editingElementId)
                    return;
                if (target === state.rootElementId)
                    return;
                e.preventDefault();
                state.ungroupElement(target);
                return;
            }
            // Cmd/Ctrl+C — copy selected element to internal clipboard.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.selectedElementIds.length === 0)
                    return;
                if (state.editingElementId)
                    return;
                e.preventDefault();
                state.copyElement(state.selectedElementIds[0]);
                return;
            }
            // Cmd/Ctrl+V — paste from internal clipboard.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.editingElementId)
                    return;
                e.preventDefault();
                state.pasteElement();
                return;
            }
            // Cmd/Ctrl+Z — undo. Cmd/Ctrl+Shift+Z — redo.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                if (e.shiftKey) {
                    useHistoryStore.getState().redo();
                }
                else {
                    useHistoryStore.getState().undo();
                }
                return;
            }
            // Cmd/Ctrl+Shift+H — toggle the left sidebar tab between
            // Pages & Layers and History.
            if ((e.metaKey || e.ctrlKey) &&
                e.shiftKey &&
                (e.key === 'h' || e.key === 'H')) {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                const canvas = useCanvasStore.getState();
                canvas.setLeftSidebarTab(canvas.leftSidebarTab === 'history' ? 'layers' : 'history');
                return;
            }
            // Cmd/Ctrl+G — wrap the current selection in a new flex group.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'g' || e.key === 'G')) {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.selectedElementIds.length === 0)
                    return;
                if (state.editingElementId)
                    return;
                e.preventDefault();
                state.groupElements(state.selectedElementIds);
                return;
            }
            // Ctrl+D / Cmd+D — duplicate the selected element(s).
            if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                // Don't fire when the user is typing into an input, the CSS panel,
                // or a contentEditable text element.
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.selectedElementIds.length === 0)
                    return;
                if (state.editingElementId)
                    return;
                e.preventDefault();
                // Duplicate every selected element. Each call updates the store
                // and selects the new clone, so the final selection is the last
                // duplicate — fine for the common single-select case and reasonable
                // for multi-select too.
                for (const id of state.selectedElementIds) {
                    useCanvasStore.getState().duplicateElement(id);
                }
                return;
            }
            // Delete / Backspace — remove the selected element(s) (and any
            // descendants). The page root is protected by the store action.
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.selectedElementIds.length === 0)
                    return;
                if (state.editingElementId)
                    return;
                e.preventDefault();
                // Phase 7: delete-prop-text-with-overrides warning. Only
                // relevant in the component editor — page-side deletes of
                // text don't have the prop concept. Walk the selection
                // for any prop-text whose name has an override on a
                // matching page instance.
                const activeName = state.activeComponent?.name ?? null;
                if (activeName !== null) {
                    const propsAtRisk = [];
                    for (const id of state.selectedElementIds) {
                        const el = state.elements[id];
                        if (!el || el.type !== 'text')
                            continue;
                        if (typeof el.prop !== 'string' || el.prop.length === 0)
                            continue;
                        propsAtRisk.push(el.prop);
                    }
                    if (propsAtRisk.length > 0) {
                        const usages = findInstanceUsagesAcrossPages(project.pages, activeName);
                        const overriding = usages.filter((u) => propsAtRisk.some((p) => Object.prototype.hasOwnProperty.call(u.propOverrides, p)));
                        if (overriding.length > 0) {
                            setDeletePropTextRequest({
                                elementIds: [...state.selectedElementIds],
                                propsAtRisk,
                                impactByPage: groupUsagesByPage(overriding),
                            });
                            return;
                        }
                    }
                }
                for (const id of state.selectedElementIds) {
                    if (id === state.rootElementId)
                        continue;
                    useCanvasStore.getState().deleteElement(id);
                }
                return;
            }
            // Arrow keys — nudge the selected element(s) by 1px, or 10px with
            // Shift. Only moves elements whose parent is non-flex (flex layout
            // owns the child's position). Matches Figma's convention.
            if (e.key === 'ArrowUp' ||
                e.key === 'ArrowDown' ||
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight') {
                if (isEditableTarget(e.target))
                    return;
                const state = useCanvasStore.getState();
                if (state.selectedElementIds.length === 0)
                    return;
                if (state.editingElementId)
                    return;
                // Ignore modifier combos we don't own (Cmd/Ctrl+arrow is a
                // platform navigation shortcut; let the browser handle it).
                if (e.metaKey || e.ctrlKey || e.altKey)
                    return;
                const step = e.shiftKey ? 10 : 1;
                let dx = 0;
                let dy = 0;
                if (e.key === 'ArrowLeft')
                    dx = -step;
                else if (e.key === 'ArrowRight')
                    dx = step;
                else if (e.key === 'ArrowUp')
                    dy = -step;
                else if (e.key === 'ArrowDown')
                    dy = step;
                let moved = false;
                for (const id of state.selectedElementIds) {
                    if (id === state.rootElementId)
                        continue;
                    const el = state.elements[id];
                    if (!el || !el.parentId)
                        continue;
                    const parent = state.elements[el.parentId];
                    if (!parent)
                        continue;
                    // Flex layout owns child positions — nudge is meaningless.
                    if (parent.display === 'flex')
                        continue;
                    const clamped = clampToParent(el.x + dx, el.y + dy, el.widthValue, el.heightValue, parent.widthValue, parent.heightValue);
                    if (clamped.x !== el.x || clamped.y !== el.y) {
                        state.moveElement(id, Math.round(clamped.x), Math.round(clamped.y));
                        moved = true;
                    }
                }
                if (moved)
                    e.preventDefault();
                return;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
        // toggleTerminalPanel and duplicateElement are read fresh from the
        // store on every keystroke, so this listener doesn't need to re-bind.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Esc anywhere outside a text input exits the component editor
    // back to the prior page (or the project shell if entered from
    // the sidebar list). Only fires when activeComponent is non-null
    // — page-mode Esc is owned by the existing handlers above.
    useEffect(() => {
        if (activeComponent === null)
            return;
        const handler = (e) => {
            if (e.key !== 'Escape')
                return;
            // Skip when the user is mid-edit inside an input / textarea /
            // contentEditable — those have their own Esc semantics
            // (commit / cancel inline edits).
            const target = e.target;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' ||
                    tag === 'TEXTAREA' ||
                    tag === 'SELECT' ||
                    target.isContentEditable) {
                    return;
                }
            }
            exitComponentEditor();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
        // exitComponentEditor reads activeComponent + state setters
        // fresh on each call, so we don't need it in the dep array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeComponent]);
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
            onProjectChange?.({
                ...project,
                pages: [...project.pages, newPage],
            });
            setActivePageName(newPage.name);
            resetPageEdit();
        }
        catch (e) {
            setPageEditError(e instanceof Error ? e.message : String(e));
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
            setPageEditError(e instanceof Error ? e.message : String(e));
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
            setPageEditError(e instanceof Error ? e.message : String(e));
            setPageEditBusy(false);
        }
    };
    const handleDeletePage = async (name) => {
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
            // Surface failures as a basic alert — delete errors are rare and
            // don't have a dedicated inline surface today.
            // eslint-disable-next-line no-alert
            window.alert(e instanceof Error ? e.message : String(e));
            setDeletingPageName(null);
        }
    };
    // ---- Components ----
    /**
     * Mirror the canvas's current `pageSource` (the just-serialized
     * TSX + CSS for the active target) back into
     * `project.pages` / `project.components` before swapping
     * targets. Without this, the per-target snapshots in
     * `project.*` stay frozen at their initial-load content, and
     * the load useEffect's call to `parseCode(snapshot.tsxContent,
     * …)` parses the OLD blank template on every re-entry —
     * silently dropping every edit the user made.
     *
     * `flushPendingPageWrite()` must run BEFORE this helper so any
     * unwritten changes are first serialized into `pageSource`
     * via `writeIfDirty → setPageSource`.
     */
    const persistActiveSource = () => {
        const source = useCanvasStore.getState().pageSource;
        if (!source)
            return;
        // Capture the target identity from the React closure (NOT the
        // mutating `prev` arg) since the rule "are we on a page or a
        // component" doesn't change between queued updates — it's
        // determined by what the user is editing right now.
        const targetComponentName = activeComponent !== null ? activeComponent.name : null;
        const targetPageName = activePageName;
        if (targetComponentName !== null) {
            // Use a functional updater so a previously-queued
            // setProject from the same handler (e.g. convert-to-
            // component adding a new entry to project.components)
            // composes correctly with this update instead of getting
            // stomped by the closure-captured `project` ref.
            onProjectChange?.((prev) => {
                const existing = prev.components.find((c) => c.name === targetComponentName);
                if (existing &&
                    existing.tsxContent === source.tsx &&
                    existing.cssContent === source.css) {
                    return prev;
                }
                return {
                    ...prev,
                    components: prev.components.map((c) => c.name === targetComponentName
                        ? { ...c, tsxContent: source.tsx, cssContent: source.css }
                        : c),
                };
            });
            return;
        }
        if (targetPageName !== null) {
            onProjectChange?.((prev) => {
                const existing = prev.pages.find((p) => p.name === targetPageName);
                if (existing &&
                    existing.tsxContent === source.tsx &&
                    existing.cssContent === source.css) {
                    return prev;
                }
                return {
                    ...prev,
                    pages: prev.pages.map((p) => p.name === targetPageName
                        ? { ...p, tsxContent: source.tsx, cssContent: source.css }
                        : p),
                };
            });
        }
    };
    /**
     * Open the named component in the component editor. Flushes any
     * pending edit on the OUTGOING target first so a debounced page
     * write doesn't fire after we've switched the active target,
     * then persists the outgoing target's latest content into
     * `project.*` so re-entry picks up the user's work instead of
     * a stale snapshot. `fromPage` records the page we're leaving
     * so Esc / breadcrumb click can return there; Phase 2 always
     * passes null because the only entry point is the sidebar list.
     */
    const openComponent = (name, fromPage) => {
        flushPendingPageWrite();
        persistActiveSource();
        setActiveComponentState({ name, returnToPage: fromPage });
    };
    /**
     * Exit the component editor. If the user entered from a page,
     * return there; otherwise drop back to whatever page is the
     * current default. Flushes the pending component write first
     * so the component's changes land on disk before the canvas
     * swaps to the page target, then persists the latest serialized
     * source into `project.components` so re-entry shows the user's
     * work, not the original template.
     */
    const exitComponentEditor = () => {
        if (activeComponent === null)
            return;
        flushPendingPageWrite();
        persistActiveSource();
        const next = activeComponent.returnToPage;
        setActiveComponentState(null);
        if (next !== null)
            setActivePageName(next);
    };
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
            setComponentEditError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setCreatingComponent(false);
        }
    };
    // ---- Convert-to-component flow ----
    // Element id queued for the create-component dialog. Set when
    // the user picks "Create component…" from the right-click
    // menu; cleared on cancel or after the new component lands.
    const [convertElementId, setConvertElementId] = useState(null);
    const [convertingComponent, setConvertingComponent] = useState(false);
    const [convertError, setConvertError] = useState(null);
    // Subscribe to the menu's `scamp:convert-to-component` event.
    // The handler stashes the element id so the dialog renders on
    // the next paint; the actual write happens on the dialog's
    // confirm.
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            setConvertError(null);
            setConvertElementId(detail.elementId);
        };
        window.addEventListener(CONVERT_TO_COMPONENT_EVENT, handler);
        return () => window.removeEventListener(CONVERT_TO_COMPONENT_EVENT, handler);
    }, []);
    /**
     * Run the convert-to-component flow: generate the component
     * files from the source subtree, write them via the createComponent
     * IPC, splice an instance into the page tree in place of the
     * source subtree, and open the new component in the editor.
     *
     * Phase 4 is not fully atomic: if the file write succeeds but
     * the page write (debounced through the sync bridge) later
     * fails, the on-disk component exists but the page still
     * references the old subtree. Phase 7 adds stage-and-swap
     * semantics for that and the rename / lock-prop flows.
     */
    const handleConvertToComponent = async (elementId, name) => {
        setConvertingComponent(true);
        setConvertError(null);
        try {
            const state = useCanvasStore.getState();
            const generated = generateComponentFromSubtree(state.elements, elementId, name, state.breakpoints);
            if (!generated) {
                throw new Error('Could not extract the selected element.');
            }
            const created = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: name,
                tsxContent: generated.tsx,
                cssContent: generated.css,
            });
            // In-memory page mutation. The sync bridge debounces the
            // page TSX write that follows — the file IS Scamp's
            // own write, so the chokidar pending-write tracker
            // suppresses the round-trip event.
            state.replaceSubtreeWithInstance(elementId, name);
            // Use a functional updater so this update composes with
            // `openComponent → persistActiveSource`'s follow-on
            // setProject (which mirrors the page's new in-memory
            // state). Without the functional form, the second call's
            // closure-captured `project` would lack `created` and
            // clobber this add — the user would briefly see the
            // editor for a component that's no longer in the list,
            // and the resulting useEffect-triggered reset would
            // corrupt the on-disk page with the component's content
            // (since stale `project.pages[home]` round-trips through
            // a load).
            onProjectChange?.((prev) => ({
                ...prev,
                components: [...prev.components, created],
            }));
            setConvertElementId(null);
            openComponent(created.name, activePageName);
        }
        catch (e) {
            setConvertError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setConvertingComponent(false);
        }
    };
    // Phase 7: lock-prop-with-overrides warning. When the user
    // toggles a prop-text Prop → Locked in the Data tab, the panel
    // dispatches REQUEST_LOCK_PROP_EVENT. We compute how many
    // instances across all pages currently override that prop; if
    // any do, surface a ConfirmDialog. If none do, lock silently.
    const [lockPropRequest, setLockPropRequest] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            const usages = findInstanceUsagesAcrossPages(project.pages, detail.componentName);
            const overriding = filterUsagesWithPropOverride(usages, detail.propName);
            if (overriding.length === 0) {
                // No data at risk — commit immediately. The Data tab's
                // SegmentedControl already showed the new state
                // optimistically; running the store action now confirms
                // it without a dialog flash.
                useCanvasStore.getState().togglePropOnText(detail.elementId);
                return;
            }
            setLockPropRequest({
                elementId: detail.elementId,
                propName: detail.propName,
                impactByPage: groupUsagesByPage(overriding),
            });
        };
        window.addEventListener(REQUEST_LOCK_PROP_EVENT, handler);
        return () => window.removeEventListener(REQUEST_LOCK_PROP_EVENT, handler);
    }, [project.pages]);
    const handleConfirmLockProp = () => {
        if (!lockPropRequest)
            return;
        useCanvasStore.getState().togglePropOnText(lockPropRequest.elementId);
        setLockPropRequest(null);
    };
    // Phase 7: delete-prop-text-with-overrides warning. Captured by
    // the keyboard delete handler when the selection contains at
    // least one prop-text whose name is currently overridden on
    // some page instance. Confirm → run the regular delete chain.
    // Cancel → do nothing. No instance cleanup: the override keys
    // become silently inert (the prop no longer exists, so the
    // resolver falls back to nothing). Phase 8/9 has the cleaner
    // detach path.
    const [deletePropTextRequest, setDeletePropTextRequest] = useState(null);
    const handleConfirmDeletePropText = () => {
        if (!deletePropTextRequest)
            return;
        const state = useCanvasStore.getState();
        for (const id of deletePropTextRequest.elementIds) {
            if (id === state.rootElementId)
                continue;
            useCanvasStore.getState().deleteElement(id);
        }
        setDeletePropTextRequest(null);
    };
    // Phase 8: detach-from-component flow. Right-click on an
    // instance dispatches DETACH_INSTANCE_EVENT; the handler
    // captures the target id + component name + override-count for
    // the dialog. Confirm runs the store action.
    const [detachRequest, setDetachRequest] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            const state = useCanvasStore.getState();
            const el = state.elements[detail.instanceId];
            if (!el || el.type !== 'component-instance')
                return;
            const componentName = el.componentName ?? '(unnamed)';
            const overrideCount = Object.keys(el.propOverrides ?? {}).length;
            setDetachRequest({
                instanceId: detail.instanceId,
                componentName,
                overrideCount,
            });
        };
        window.addEventListener(DETACH_INSTANCE_EVENT, handler);
        return () => window.removeEventListener(DETACH_INSTANCE_EVENT, handler);
    }, []);
    const handleConfirmDetach = () => {
        if (!detachRequest)
            return;
        useCanvasStore.getState().detachInstance(detachRequest.instanceId);
        setDetachRequest(null);
    };
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
    /**
     * Run the multi-file delete: rewrite every affected page so its
     * instances of the named component are gone, then call the
     * `component:delete` IPC to remove the folder, then update
     * project state. Best-effort sequential — true atomicity (stage-
     * and-swap with rollback) is deferred per the safety-first
     * Phase 7 slice. A partial failure leaves the project in a
     * state Scamp can recover from on next open (parser surfaces
     * missing-component instances as labelled red placeholders).
     */
    const handleConfirmDeleteComponent = async () => {
        if (!deletingComponent)
            return;
        const { componentName } = deletingComponent;
        setComponentDeleteBusy(true);
        // Same suppression as rename: deleting a component that the
        // user is currently editing transitions the active target
        // (component → page) AFTER the on-disk folder has been
        // removed. Without this, the default target-swap flush
        // attempts to write to the deleted path → "Save failed". The
        // one-shot flag is consumed on the next target swap; the TTL
        // auto-clears if no swap happens (e.g. user wasn't inside
        // the deleted component).
        armTargetSwapSuppression();
        try {
            const breakpoints = useCanvasStore.getState().breakpoints;
            const updatedPages = [];
            for (const page of project.pages) {
                const parsed = parseCode(page.tsxContent, page.cssContent, {
                    breakpoints,
                });
                // Collect instance ids of the deleted component; delete
                // them via the same store-shape pruning the store would
                // do. We strip from the element map AND from every
                // parent's childIds.
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
            // Folder removal — last so a partial page-write doesn't
            // leave the page with dangling imports against a missing
            // folder. (Imports still resolve to the on-disk file until
            // this call completes.)
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName,
            });
            // If the user was editing this component, drop them back
            // to the entry page so the canvas doesn't try to render
            // against a now-empty file pair.
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
            // Mid-delete failure: no target swap is going to land. Disarm
            // the suppression so an unrelated swap later doesn't get its
            // flush silently consumed.
            disarmTargetSwapSuppression();
            // Surface the failure via the app log; leave the dialog
            // open so the user can retry or cancel. ConfirmDialog
            // doesn't have an inline-error slot — Phase 8/9 plumbs
            // that in.
            const message = err instanceof Error ? err.message : String(err);
            useAppLogStore
                .getState()
                .log('warn', `Delete component "${componentName}" failed: ${message}`);
        }
        finally {
            setComponentDeleteBusy(false);
        }
    };
    /**
     * Phase 7.2: multi-file component rename. Flushes the active
     * canvas to disk first so `project.pages[i].tsxContent` is the
     * current truth, then rewrites the component file + every page
     * that imports it, then deletes the old folder. Updates React
     * state + canvas store afterward.
     *
     * Best-effort sequential per the safety-first scope. A failure
     * mid-rewrite leaves a mix of old + new on disk; the parser's
     * missing-component placeholders make this recoverable on
     * next open. Phase 9+ adds true stage-and-swap atomicity.
     */
    const handleRenameComponent = async (oldName, newName) => {
        if (oldName === newName) {
            setComponentEdit(null);
            return;
        }
        setRenamingComponent(true);
        setComponentEditError(null);
        // The rename ends by transitioning the active target's
        // identity (canvas-store `activeComponent` swap, via the
        // load-component useEffect). The default swap behaviour
        // flushes the OUTGOING target's content to its file — but
        // the OUTGOING file path is the one we just deleted. Arm a
        // one-shot suppression now so that swap is a no-op write-
        // wise. The TTL inside syncBridge auto-clears the flag if
        // for some reason no swap actually happens (e.g. user was
        // on a different page, rename succeeded, no transition).
        armTargetSwapSuppression();
        try {
            // Flush any pending debounced write so the active page's
            // on-disk content matches the in-memory store. Then mirror
            // pageSource back into project.* so the snapshot we iterate
            // below is fresh.
            flushPendingPageWrite();
            persistActiveSource();
            // Re-read project state via the change callback would be
            // racy in a single tick, so we capture the latest values
            // from React state (the closures already point at the
            // current project ref).
            const breakpoints = useCanvasStore.getState().breakpoints;
            // Find the source component file. If it's missing we can't
            // proceed — bail with an inline error.
            const sourceComponent = project.components.find((c) => c.name === oldName);
            if (!sourceComponent) {
                throw new Error(`Component "${oldName}" not found in project.`);
            }
            // Rewrite the component's TSX/CSS with the new identifier.
            const newContent = rewriteComponentForRename(sourceComponent.tsxContent, sourceComponent.cssContent, oldName, newName, { breakpoints });
            // Rewrite each page that references oldName. Skip pages
            // that don't — they keep byte-stable on disk.
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
            // Write the new component (creates the new folder + files).
            const newComponentFile = await window.scamp.createComponent({
                projectPath: project.path,
                componentName: newName,
                tsxContent: newContent.tsx,
                cssContent: newContent.css,
            });
            // Write each rewritten page.
            for (const entry of rewrittenPages) {
                await window.scamp.writeFile({
                    tsxPath: entry.file.tsxPath,
                    cssPath: entry.file.cssPath,
                    tsxContent: entry.tsx,
                    cssContent: entry.css,
                });
            }
            // Finally drop the old folder. We do this AFTER all rewrites
            // so a transient failure during page-write doesn't leave the
            // page with a dangling import against a missing folder.
            await window.scamp.deleteComponent({
                projectPath: project.path,
                componentName: oldName,
            });
            // Update in-memory project state: components list + pages list.
            const nextComponents = project.components.map((c) => c.name === oldName ? newComponentFile : c);
            const nextPages = [
                ...unchangedPages,
                ...rewrittenPages.map((e) => ({
                    ...e.file,
                    tsxContent: e.tsx,
                    cssContent: e.css,
                })),
            ];
            // Preserve original page order so the sidebar doesn't
            // visually reshuffle on rename.
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
            // If the user was inside the renamed component's editor,
            // re-point activeComponent to the new path. The sync
            // bridge picks up the new tsxPath/cssPath from this on its
            // next subscribe tick.
            if (activeComponent !== null && activeComponent.name === oldName) {
                setActiveComponentState({
                    name: newName,
                    returnToPage: activeComponent.returnToPage,
                });
            }
            // The active page (if any) has its `componentName` fields
            // updated in-memory so the canvas keeps rendering the right
            // component while the user is still on this view.
            useCanvasStore.getState().renameComponentReferences(oldName, newName);
            setComponentEdit(null);
        }
        catch (err) {
            // Mid-rename failure: no target swap is going to land (we
            // never updated React state). Disarm the suppression so an
            // unrelated swap later in the session doesn't get its flush
            // silently consumed.
            disarmTargetSwapSuppression();
            const message = err instanceof Error ? err.message : String(err);
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
    return (_jsxs("div", { className: styles.shell, children: [_jsxs("header", { className: styles.toolbar, children: [_jsx("button", { className: styles.backButton, onClick: onClose, type: "button", children: "\u2190 Projects" }), _jsx("span", { className: styles.spacer }), _jsx(ZoomControls, {}), _jsx(Tooltip, { label: "Toggle code panel", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'code' ? styles.toggleActive : ''}`, onClick: toggleCodePanel, type: "button", children: [_jsx(IconCode, { size: 14, className: styles.toggleButtonIcon }), "Code"] }) }), _jsx(Tooltip, { label: "Toggle terminal (Ctrl+`)", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'terminal' ? styles.toggleActive : ''}`, onClick: toggleTerminalPanel, type: "button", children: [_jsx(IconTerminal2, { size: 14, className: styles.toggleButtonIcon }), "Terminal"] }) }), _jsx(Tooltip, { label: canPreview
                            ? 'Open this project in a real browser preview window (⌘P)'
                            : projectFormatForPreview === 'legacy'
                                ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                                : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.toggleButton, onClick: openPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: 14, className: styles.toggleButtonIcon }), "Preview"] }) }), _jsx(SaveStatusIndicator, {}), _jsx("span", { className: styles.projectName, children: project.name })] }), showMigrationBanner && (_jsx(MigrationBanner, { onDismiss: handleDismissMigrationBanner })), project.format === 'legacy' && !projectConfig.nextjsMigrationDismissed && (_jsx(NextjsMigrationBanner, { project: project, onMigrated: (next) => {
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
                                                }, type: "button", children: "+ Add Component" }))] }), _jsxs("div", { className: `${styles.sidebarSection} ${styles.sidebarLayers}`, "data-testid": "layers-panel", children: [_jsx("h2", { className: styles.sidebarTitle, children: "Layers" }), _jsx(ElementTree, {})] })] })] }), _jsxs("div", { className: styles.artboard, children: [_jsx("div", { ref: artboardScrollRef, className: styles.artboardScroll, style: { backgroundColor: projectConfig.artboardBackground }, children: _jsxs("div", { className: styles.canvasContent, children: [activeComponent !== null && (_jsxs("div", { className: styles.componentEditorBanner, "data-testid": "component-editor-banner", children: [_jsxs("span", { children: ["Editing component:", ' ', _jsx("strong", { children: activeComponent.name }), ". Changes affect all instances."] }), _jsx("button", { type: "button", className: styles.componentEditorExit, onClick: exitComponentEditor, children: "Exit" })] })), _jsxs("div", { className: styles.canvasHeader, children: [activeComponent !== null ? (
                                                // Breadcrumb: "<return page> > <component>" when
                                                // entered from a page, otherwise just the
                                                // component name. Clicking a non-current segment
                                                // navigates back to it; clicking the current
                                                // segment selects the root element same as the
                                                // page badge.
                                                _jsxs("div", { className: styles.canvasHeaderBadge, role: "navigation", "aria-label": "Component editor breadcrumb", children: [activeComponent.returnToPage !== null && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: styles.canvasBreadcrumbLink, onClick: exitComponentEditor, children: activeComponent.returnToPage }), _jsx("span", { "aria-hidden": "true", children: ' › ' })] })), _jsx("button", { type: "button", className: styles.canvasBreadcrumbCurrent, onClick: () => useCanvasStore
                                                                .getState()
                                                                .selectElement(ROOT_ELEMENT_ID), title: "Select component root", children: activeComponent.name })] })) : (_jsx("button", { type: "button", className: styles.canvasHeaderBadge, onClick: () => useCanvasStore
                                                        .getState()
                                                        .selectElement(ROOT_ELEMENT_ID), title: "Select page root", children: activePageName ?? 'Page' })), _jsx("span", { className: styles.canvasHeaderSpacer }), _jsx(CanvasSizeControl, { config: projectConfig, onChange: handleProjectConfigChange, componentName: activeComponent !== null
                                                        ? activeComponent.name
                                                        : undefined })] }), _jsx(Viewport, { canvasWidth: activeComponent !== null
                                                ? (projectConfig.componentCanvas?.[activeComponent.name]
                                                    ?.width ?? DEFAULT_COMPONENT_CANVAS_SIZE.width)
                                                : projectConfig.canvasWidth, canvasHeight: activeComponent !== null
                                                ? (projectConfig.componentCanvas?.[activeComponent.name]
                                                    ?.height ?? DEFAULT_COMPONENT_CANVAS_SIZE.height)
                                                : undefined, canvasOverflowHidden: projectConfig.canvasOverflowHidden, scrollContainerRef: artboardScrollRef, 
                                            // Drag-handle resize is enabled only in component
                                            // mode; the page canvas uses the project-wide
                                            // `canvasWidth` setting (no resize handle, no
                                            // explicit height — page canvases grow with
                                            // content).
                                            onResize: activeComponent !== null
                                                ? (width, height) => {
                                                    const name = activeComponent.name;
                                                    const nextMap = {
                                                        ...(projectConfig.componentCanvas ?? {}),
                                                        [name]: { width, height },
                                                    };
                                                    handleProjectConfigChange({
                                                        ...projectConfig,
                                                        componentCanvas: nextMap,
                                                    });
                                                }
                                                : undefined })] }) }), _jsx("div", { className: styles.elementToolbar, children: _jsx(Toolbar, { onOpenSettings: () => setShowProjectSettings(true), onOpenTheme: () => setShowThemePanel(true) }) })] }), _jsx(PropertiesPanel, {})] }), bottomPanel === 'code' && _jsx(CodePanel, {}), terminalEverOpened && (_jsx(TerminalPanel, { cwd: project.path, hidden: bottomPanel !== 'terminal' }, project.path)), showThemePanel && (_jsx(ThemePanel, { projectPath: project.path, onClose: () => setShowThemePanel(false) })), showProjectSettings && (_jsx(ProjectSettingsPage, { projectName: project.name, projectPath: project.path, config: projectConfig, onChange: handleProjectConfigChange, onBack: () => setShowProjectSettings(false) })), pageMenu && (_jsx(PageContextMenu, { x: pageMenu.x, y: pageMenu.y, items: buildMenuItems(pageMenu.pageName), onClose: () => setPageMenu(null) })), componentMenu && (_jsx(PageContextMenu, { x: componentMenu.x, y: componentMenu.y, items: [
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
                ], onClose: () => setComponentMenu(null) })), _jsx(ElementContextMenu, {}), deletingPageName && (_jsx(ConfirmDialog, { title: `Delete page "${deletingPageName}"?`, message: `This will remove ${deletingPageName}.tsx and ${deletingPageName}.module.css from your project folder. This cannot be undone.`, confirmLabel: "Delete", cancelLabel: "Cancel", variant: "destructive", onConfirm: () => void handleDeletePage(deletingPageName), onCancel: () => setDeletingPageName(null) })), convertElementId !== null && (_jsx(CreateComponentDialog, { existingNames: project.components.map((c) => c.name), error: convertError, busy: convertingComponent, onConfirm: (name) => void handleConvertToComponent(convertElementId, name), onCancel: () => {
                    if (convertingComponent)
                        return;
                    setConvertElementId(null);
                    setConvertError(null);
                } })), lockPropRequest !== null && (_jsx(ConfirmDialog, { title: `Lock "${lockPropRequest.propName}"?`, message: `This will drop the override on ${lockPropRequest.impactByPage
                    .map((g) => `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`)
                    .join(', ')}. The component-side default will render in their place.`, confirmLabel: "Lock prop", variant: "destructive", onConfirm: handleConfirmLockProp, onCancel: () => setLockPropRequest(null) })), deletingComponent !== null && (_jsx(ConfirmDialog, { title: `Delete component "${deletingComponent.componentName}"?`, message: deletingComponent.impactByPage.length === 0
                    ? `Removes the components/${deletingComponent.componentName}/ folder. No instances on any page.`
                    : `Removes the components/${deletingComponent.componentName}/ folder AND every instance from: ${deletingComponent.impactByPage
                        .map((g) => `${g.pageName} (${g.count} instance${g.count === 1 ? '' : 's'})`)
                        .join(', ')}. This cannot be undone.`, confirmLabel: componentDeleteBusy ? 'Deleting…' : 'Delete component', variant: "destructive", onConfirm: () => void handleConfirmDeleteComponent(), onCancel: () => {
                    if (componentDeleteBusy)
                        return;
                    setDeletingComponent(null);
                } })), deletePropTextRequest !== null && (_jsx(ConfirmDialog, { title: deletePropTextRequest.propsAtRisk.length === 1
                    ? `Delete prop "${deletePropTextRequest.propsAtRisk[0]}"?`
                    : 'Delete prop text elements?', message: `Existing overrides on ${deletePropTextRequest.impactByPage
                    .map((g) => `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`)
                    .join(', ')} will no longer have an effect. The pages keep the attribute on disk until they re-save.`, confirmLabel: "Delete", variant: "destructive", onConfirm: handleConfirmDeletePropText, onCancel: () => setDeletePropTextRequest(null) })), detachRequest !== null && (_jsx(ConfirmDialog, { title: `Detach ${detachRequest.componentName} instance?`, message: detachRequest.overrideCount > 0
                    ? `The component's design will be copied directly into this page. Future edits to ${detachRequest.componentName} won't update this copy. Your ${detachRequest.overrideCount} override${detachRequest.overrideCount === 1 ? '' : 's'} will be baked in as literal text. This cannot be undone with re-attach.`
                    : `The component's design will be copied directly into this page. Future edits to ${detachRequest.componentName} won't update this copy. This cannot be undone with re-attach.`, confirmLabel: "Detach", variant: "destructive", onConfirm: handleConfirmDetach, onCancel: () => setDetachRequest(null) }))] }));
};
