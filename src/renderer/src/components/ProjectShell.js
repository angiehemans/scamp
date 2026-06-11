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
import { IconCode, IconPlayerPlay, IconTerminal2, } from '@tabler/icons-react';
import { DEFAULT_COMPONENT_CANVAS_SIZE, DEFAULT_PROJECT_CONFIG, } from '@shared/types';
import { errorMessage } from '@shared/errorMessage';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { useAppLogStore } from '@store/appLogSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { parseCode } from '@lib/parseCode';
import { generateCode } from '@lib/generateCode';
import { armTargetSwapSuppression, disarmTargetSwapSuppression, flushPendingPageWrite, } from '../syncBridge';
import { parseThemeFile } from '@lib/parseTheme';
import { applyThemeFonts } from '../lib/applyThemeFonts';
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
import { ParseErrorBanner } from './ParseErrorBanner';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { SaveStatusToast } from './SaveStatusToast';
import { useTerminalActivityStore } from '@store/terminalActivitySlice';
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
/**
 * Holds the latest render's `value` in a stable ref. Lets a globally-
 * bound effect (keydown listener, one-shot navigation consumer) read
 * the current closure values without listing them as deps — so the
 * listener binds once instead of re-binding on every change, and we
 * drop the `exhaustive-deps` suppressions. Written during render (not
 * in an effect) so an effect that reads `.current` synchronously sees
 * this render's value even when it's declared before this ref.
 */
const useLatest = (value) => {
    const ref = useRef(value);
    ref.current = value;
    return ref;
};
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
    // Inline error shown in the delete-confirmation dialog when the
    // delete IPC fails; keeps the dialog open so the user can retry.
    const [deletePageError, setDeletePageError] = useState(null);
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
    // Set when `parseCode` throws on the active page/component. The
    // canvas keeps its last good state and this drives the inline
    // ParseErrorBanner; cleared once the target parses again.
    const [parseError, setParseError] = useState(null);
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
            // Latest openComponent / activePageName via `componentNav`
            // (useLatest) — fire only when the one-shot request flips,
            // without a stale-closure dep suppression.
            componentNav.current.openComponent(pendingComponentNavigation, componentNav.current.activePageName);
        }
        useCanvasStore.getState().requestComponentNavigation(null);
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
            // `applyThemeFonts` derives Google families synchronously from
            // each URL, surfaces any cached Adobe kit families, then kicks
            // off background fetches to refresh Adobe kits from the network.
            applyThemeFonts(parsed.fontImportUrls);
        };
        void loadTheme();
        return () => {
            // Clear when the project unmounts so a stale project's fonts
            // don't linger in the picker.
            useFontsStore.getState().setProjectFonts({ families: [], urls: [] });
            // Reset the user's sync intent so a manual pause or override
            // from one project doesn't bleed into the next.
            useTerminalActivityStore.getState().setUserIntent('auto');
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
            // Keep the last successfully-parsed canvas instead of blanking,
            // and surface the failure inline + in the activity log. The
            // file-changed reload re-runs this effect, so a fixed file
            // clears the banner on its own.
            useAppLogStore
                .getState()
                .log('error', `Couldn't parse page "${page.name}": ${errorMessage(err)}`);
            setParseError({ targetName: page.name });
            return;
        }
        setParseError(null);
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
            // Keep the last good canvas; surface inline + in the activity log.
            useAppLogStore
                .getState()
                .log('error', `Couldn't parse component "${component.name}": ${errorMessage(err)}`);
            setParseError({ targetName: component.name });
            return;
        }
        setParseError(null);
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
                keyDeps.current.toggleTerminalPanel();
                return;
            }
            // Cmd/Ctrl+P — open the preview window.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
                if (isEditableTarget(e.target))
                    return;
                e.preventDefault();
                if (keyDeps.current.canPreview)
                    keyDeps.current.openPreview();
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
                        const usages = findInstanceUsagesAcrossPages(keyDeps.current.projectPages, activeName);
                        const overriding = usages.filter((u) => propsAtRisk.some((p) => Object.prototype.hasOwnProperty.call(u.propOverrides, p)));
                        if (overriding.length > 0) {
                            keyDeps.current.setDeletePropTextRequest({
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
        // Binds once: all closure values it reads (toggleTerminalPanel,
        // canPreview, openPreview, project.pages, setDeletePropTextRequest)
        // are read fresh via `keyDeps` (useLatest); everything else goes
        // through the store's getState().
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
            latestExit.current();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
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
    // Latest refs for the one-shot canvas→component-editor navigation
    // effect, which binds before these are defined (see useLatest).
    const componentNav = useLatest({ openComponent, activePageName });
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
    // Latest ref for the component-editor Esc handler, which binds
    // before this is defined (see useLatest).
    const latestExit = useLatest(exitComponentEditor);
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
    /** see docs/notes/components-multi-file-ops.md — Convert-to-component */
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
            state.replaceSubtreeWithInstance(elementId, name);
            // Functional updater composes with openComponent's follow-on setProject.
            onProjectChange?.((prev) => ({
                ...prev,
                components: [...prev.components, created],
            }));
            setConvertElementId(null);
            openComponent(created.name, activePageName);
        }
        catch (e) {
            setConvertError(errorMessage(e));
        }
        finally {
            setConvertingComponent(false);
        }
    };
    // Lock-prop-with-overrides warning. see docs/notes/components-multi-file-ops.md
    const [lockPropRequest, setLockPropRequest] = useState(null);
    useEffect(() => {
        const handler = (e) => {
            const detail = e.detail;
            if (!detail)
                return;
            const usages = findInstanceUsagesAcrossPages(project.pages, detail.componentName);
            const overriding = filterUsagesWithPropOverride(usages, detail.propName);
            if (overriding.length === 0) {
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
    // Delete-prop-text warning when instances override it.
    const [deletePropTextRequest, setDeletePropTextRequest] = useState(null);
    // Latest refs for the global keydown effect, which binds once and
    // reads these via `.current` (see useLatest) instead of re-binding.
    const keyDeps = useLatest({
        toggleTerminalPanel,
        canPreview,
        openPreview,
        projectPages: project.pages,
        setDeletePropTextRequest,
    });
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
    // Detach-from-component flow. see docs/notes/components-multi-file-ops.md
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
    return (_jsxs("div", { className: styles.shell, children: [_jsxs("header", { className: styles.toolbar, children: [_jsx("button", { className: styles.backButton, onClick: onClose, type: "button", children: "\u2190 Projects" }), _jsx("span", { className: styles.spacer }), _jsx(ZoomControls, {}), _jsx(Tooltip, { label: "Toggle code panel", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'code' ? styles.toggleActive : ''}`, onClick: toggleCodePanel, type: "button", children: [_jsx(IconCode, { size: 14, className: styles.toggleButtonIcon }), "Code"] }) }), _jsx(Tooltip, { label: "Toggle terminal (Ctrl+`)", children: _jsxs("button", { className: `${styles.toggleButton} ${bottomPanel === 'terminal' ? styles.toggleActive : ''}`, onClick: toggleTerminalPanel, type: "button", children: [_jsx(IconTerminal2, { size: 14, className: styles.toggleButtonIcon }), "Terminal"] }) }), _jsx(Tooltip, { label: canPreview
                            ? 'Open this project in a real browser preview window (⌘P)'
                            : projectFormatForPreview === 'legacy'
                                ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
                                : 'Open a page to enable preview.', children: _jsxs("button", { className: styles.toggleButton, onClick: openPreview, type: "button", disabled: !canPreview, "data-testid": "preview-button", children: [_jsx(IconPlayerPlay, { size: 14, className: styles.toggleButtonIcon }), "Preview"] }) }), _jsx(SaveStatusIndicator, {}), _jsx("span", { className: styles.projectName, children: project.name })] }), _jsx(SaveStatusToast, {}), showMigrationBanner && (_jsx(MigrationBanner, { onDismiss: handleDismissMigrationBanner })), parseError && (_jsx(ParseErrorBanner, { targetName: parseError.targetName, onDismiss: () => setParseError(null) })), project.format === 'legacy' && !projectConfig.nextjsMigrationDismissed && (_jsx(NextjsMigrationBanner, { project: project, onMigrated: (next) => {
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
                ], onClose: () => setComponentMenu(null) })), _jsx(ElementContextMenu, {}), deletingPageName && (_jsx(ConfirmDialog, { title: `Delete page "${deletingPageName}"?`, message: `This will remove ${deletingPageName}.tsx and ${deletingPageName}.module.css from your project folder. This cannot be undone.`, confirmLabel: "Delete", cancelLabel: "Cancel", variant: "destructive", error: deletePageError, onConfirm: () => void handleDeletePage(deletingPageName), onCancel: () => {
                    setDeletingPageName(null);
                    setDeletePageError(null);
                } })), convertElementId !== null && (_jsx(CreateComponentDialog, { existingNames: project.components.map((c) => c.name), error: convertError, busy: convertingComponent, onConfirm: (name) => void handleConvertToComponent(convertElementId, name), onCancel: () => {
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
