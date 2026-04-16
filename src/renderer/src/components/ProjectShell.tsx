import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useState } from 'react';
import type { ProjectData, PageFile, ProjectConfig } from '@shared/types';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { parseCode } from '@lib/parseCode';
import { flushPendingPageWrite } from '../syncBridge';
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
import { ThemePanel } from './ThemePanel';
import { ZoomControls } from './ZoomControls';
import { Tooltip } from './controls/Tooltip';
import { PageNameInput } from './PageNameInput';
import { PageContextMenu, type PageMenuItem } from './PageContextMenu';
import { ConfirmDialog } from './ConfirmDialog';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import styles from './ProjectShell.module.css';

type Props = {
  project: ProjectData;
  onClose: () => void;
  /** Called after a page is added, duplicated, or deleted. */
  onProjectChange?: (next: ProjectData) => void;
};

export const ProjectShell = ({
  project,
  onClose,
  onProjectChange,
}: Props): JSX.Element => {
  const [activePageName, setActivePageName] = useState<string | null>(
    project.pages[0]?.name ?? null
  );
  // Pages sidebar inline-edit state. `'new'` shows the Add Page input at
  // the bottom of the list. `{ duplicate: name }` replaces the named row
  // with an input seeded from that page. `null` means no editing in
  // progress and the sidebar behaves normally.
  const [pageEdit, setPageEdit] = useState<
    'new' | { duplicate: string } | { rename: string } | null
  >(null);
  const [pageEditBusy, setPageEditBusy] = useState(false);
  const [pageEditError, setPageEditError] = useState<string | null>(null);
  // Right-click context menu — stores the viewport coords and the page
  // name the menu was opened for.
  const [pageMenu, setPageMenu] = useState<{
    x: number;
    y: number;
    pageName: string;
  } | null>(null);
  // Page pending deletion (confirmation dialog is open).
  const [deletingPageName, setDeletingPageName] = useState<string | null>(null);
  // Per-project config loaded from scamp.config.json. Default values
  // render immediately so the canvas doesn't flash a wrong background
  // while the first read is in flight.
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(
    DEFAULT_PROJECT_CONFIG
  );
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const next = await window.scamp.readProjectConfig({
        projectPath: project.path,
      });
      if (!cancelled) setProjectConfig(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [project.path]);

  const handleProjectConfigChange = useCallback(
    (next: ProjectConfig): void => {
      setProjectConfig(next);
      void window.scamp.writeProjectConfig({
        projectPath: project.path,
        config: next,
      });
    },
    [project.path]
  );

  const loadPage = useCanvasStore((s) => s.loadPage);
  const resetForNewPage = useCanvasStore((s) => s.resetForNewPage);
  const bottomPanel = useCanvasStore((s) => s.bottomPanel);
  const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);

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
    if (bottomPanel === 'terminal') setTerminalEverOpened(true);
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
    const existing = new Map<string, HTMLLinkElement>();
    document
      .querySelectorAll<HTMLLinkElement>(`link[${ATTR}]`)
      .forEach((el) => {
        const u = el.getAttribute(ATTR);
        if (u) existing.set(u, el);
      });
    const wanted = new Set(projectFontUrls);
    for (const [url, el] of existing) {
      if (!wanted.has(url)) el.remove();
    }
    for (const url of projectFontUrls) {
      if (existing.has(url)) continue;
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
        .querySelectorAll<HTMLLinkElement>(`link[data-scamp-font-import]`)
        .forEach((el) => el.remove());
    };
  }, []);

  // Load theme tokens + font imports from theme.css on project open.
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
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
  useEffect(() => {
    if (!activePageName) {
      resetForNewPage();
      return;
    }
    const page: PageFile | undefined = project.pages.find((p) => p.name === activePageName);
    if (!page) {
      resetForNewPage();
      return;
    }
    const parsed = parseCode(page.tsxContent, page.cssContent);
    loadPage(
      { name: page.name, tsxPath: page.tsxPath, cssPath: page.cssPath },
      parsed.elements,
      { tsx: page.tsxContent, css: page.cssContent }
    );
    // Fresh page load — clear undo history so the user can't undo past
    // the initial state of this page.
    useCanvasStore.temporal.getState().clear();
  }, [activePageName, project.pages, loadPage, resetForNewPage]);

  const toggleCodePanel = (): void => {
    setBottomPanel(bottomPanel === 'code' ? 'none' : 'code');
  };

  const toggleTerminalPanel = (): void => {
    setBottomPanel(bottomPanel === 'terminal' ? 'none' : 'terminal');
  };

  // Global keyboard shortcuts. We deliberately read store state inside the
  // handler (rather than via React state captured in deps) so the listener
  // can stay attached for the lifetime of the component.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKey = (e: KeyboardEvent): void => {
      // Ctrl+` / Cmd+` — toggle the terminal (matches VS Code).
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminalPanel();
        return;
      }

      // Cmd/Ctrl+= or Cmd/Ctrl++ — zoom canvas in. We accept both because
      // the unshifted "+" key actually emits "=" on US keyboards, while
      // shifted versions (or non-US layouts) emit "+".
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useCanvasStore.getState().zoomIn();
        return;
      }

      // Cmd/Ctrl+- — zoom canvas out.
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useCanvasStore.getState().zoomOut();
        return;
      }

      // Cmd/Ctrl+0 — reset canvas zoom (back to fit-to-container).
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useCanvasStore.getState().resetZoom();
        return;
      }

      // Shift+Cmd/Ctrl+G — ungroup the selected element. We check this
      // BEFORE the plain Cmd+G branch so the shift modifier wins.
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === 'g' || e.key === 'G')
      ) {
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        const target = state.selectedElementIds[0];
        if (!target) return;
        if (state.editingElementId) return;
        if (target === state.rootElementId) return;
        e.preventDefault();
        state.ungroupElement(target);
        return;
      }

      // Cmd/Ctrl+C — copy selected element to internal clipboard.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.selectedElementIds.length === 0) return;
        if (state.editingElementId) return;
        e.preventDefault();
        state.copyElement(state.selectedElementIds[0]!);
        return;
      }

      // Cmd/Ctrl+V — paste from internal clipboard.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.editingElementId) return;
        e.preventDefault();
        state.pasteElement();
        return;
      }

      // Cmd/Ctrl+Z — undo. Cmd/Ctrl+Shift+Z — redo.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) {
          useCanvasStore.temporal.getState().redo();
        } else {
          useCanvasStore.temporal.getState().undo();
        }
        return;
      }

      // Cmd/Ctrl+G — wrap the current selection in a new flex group.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'g' || e.key === 'G')) {
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.selectedElementIds.length === 0) return;
        if (state.editingElementId) return;
        e.preventDefault();
        state.groupElements(state.selectedElementIds);
        return;
      }

      // Ctrl+D / Cmd+D — duplicate the selected element(s).
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        // Don't fire when the user is typing into an input, the CSS panel,
        // or a contentEditable text element.
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.selectedElementIds.length === 0) return;
        if (state.editingElementId) return;
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
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.selectedElementIds.length === 0) return;
        if (state.editingElementId) return;
        e.preventDefault();
        for (const id of state.selectedElementIds) {
          if (id === state.rootElementId) continue;
          useCanvasStore.getState().deleteElement(id);
        }
        return;
      }

      // Arrow keys — nudge the selected element(s) by 1px, or 10px with
      // Shift. Only moves elements whose parent is non-flex (flex layout
      // owns the child's position). Matches Figma's convention.
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
      ) {
        if (isEditableTarget(e.target)) return;
        const state = useCanvasStore.getState();
        if (state.selectedElementIds.length === 0) return;
        if (state.editingElementId) return;
        // Ignore modifier combos we don't own (Cmd/Ctrl+arrow is a
        // platform navigation shortcut; let the browser handle it).
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        let moved = false;
        for (const id of state.selectedElementIds) {
          if (id === state.rootElementId) continue;
          const el = state.elements[id];
          if (!el || !el.parentId) continue;
          const parent = state.elements[el.parentId];
          if (!parent) continue;
          // Flex layout owns child positions — nudge is meaningless.
          if (parent.display === 'flex') continue;
          const clamped = clampToParent(
            el.x + dx,
            el.y + dy,
            el.widthValue,
            el.heightValue,
            parent.widthValue,
            parent.heightValue
          );
          if (clamped.x !== el.x || clamped.y !== el.y) {
            state.moveElement(id, Math.round(clamped.x), Math.round(clamped.y));
            moved = true;
          }
        }
        if (moved) e.preventDefault();
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // toggleTerminalPanel and duplicateElement are read fresh from the
    // store on every keystroke, so this listener doesn't need to re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Page management ----

  const existingPageNames = project.pages.map((p) => p.name);

  const resetPageEdit = (): void => {
    setPageEdit(null);
    setPageEditBusy(false);
    setPageEditError(null);
  };

  const handleAddPage = async (name: string): Promise<void> => {
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
    } catch (e) {
      setPageEditError(e instanceof Error ? e.message : String(e));
      setPageEditBusy(false);
    }
  };

  const handleDuplicatePage = async (
    sourcePageName: string,
    newName: string
  ): Promise<void> => {
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
    } catch (e) {
      setPageEditError(e instanceof Error ? e.message : String(e));
      setPageEditBusy(false);
    }
  };

  const handleRenamePage = async (
    oldName: string,
    newName: string
  ): Promise<void> => {
    setPageEditBusy(true);
    setPageEditError(null);
    try {
      // Ensure any pending debounced write lands on the OLD files
      // before the rename swaps them out from under us.
      flushPendingPageWrite();
      const newPage = await window.scamp.renamePage({
        projectPath: project.path,
        oldPageName: oldName,
        newPageName: newName,
      });
      const nextPages = project.pages.map((p) =>
        p.name === oldName ? newPage : p
      );
      onProjectChange?.({ ...project, pages: nextPages });
      if (activePageName === oldName) {
        setActivePageName(newPage.name);
      }
      // Rename is a file-level operation outside the canvas history.
      useCanvasStore.temporal.getState().clear();
      resetPageEdit();
    } catch (e) {
      setPageEditError(e instanceof Error ? e.message : String(e));
      setPageEditBusy(false);
    }
  };

  const handleDeletePage = async (name: string): Promise<void> => {
    try {
      await window.scamp.deletePage({ projectPath: project.path, pageName: name });
      const nextPages = project.pages.filter((p) => p.name !== name);
      onProjectChange?.({ ...project, pages: nextPages });
      if (activePageName === name) {
        setActivePageName(nextPages[0]?.name ?? null);
      }
      setDeletingPageName(null);
    } catch (e) {
      // Surface failures as a basic alert — delete errors are rare and
      // don't have a dedicated inline surface today.
      // eslint-disable-next-line no-alert
      window.alert(e instanceof Error ? e.message : String(e));
      setDeletingPageName(null);
    }
  };

  const openPageMenu = (e: ReactMouseEvent, pageName: string): void => {
    e.preventDefault();
    e.stopPropagation();
    setPageMenu({ x: e.clientX, y: e.clientY, pageName });
  };

  const buildMenuItems = (pageName: string): PageMenuItem[] => [
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

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <button className={styles.backButton} onClick={onClose} type="button">
          ← Projects
        </button>
        <Toolbar
          onOpenSettings={() => setShowProjectSettings(true)}
          onOpenTheme={() => setShowThemePanel(true)}
        />
        <span className={styles.spacer} />
        <ZoomControls />
        <Tooltip label="Toggle code panel">
          <button
            className={`${styles.toggleButton} ${
              bottomPanel === 'code' ? styles.toggleActive : ''
            }`}
            onClick={toggleCodePanel}
            type="button"
          >
            Code {bottomPanel === 'code' ? '▾' : '▸'}
          </button>
        </Tooltip>
        <Tooltip label="Toggle terminal (Ctrl+`)">
          <button
            className={`${styles.toggleButton} ${
              bottomPanel === 'terminal' ? styles.toggleActive : ''
            }`}
            onClick={toggleTerminalPanel}
            type="button"
          >
            Terminal {bottomPanel === 'terminal' ? '▾' : '▸'}
          </button>
        </Tooltip>
        <span className={styles.projectName}>{project.name}</span>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h2 className={styles.sidebarTitle}>Pages</h2>
            <ul className={styles.pageList}>
              {project.pages.map((page) => {
                const isDuplicating =
                  pageEdit !== null &&
                  pageEdit !== 'new' &&
                  'duplicate' in pageEdit &&
                  pageEdit.duplicate === page.name;
                const isRenaming =
                  pageEdit !== null &&
                  pageEdit !== 'new' &&
                  'rename' in pageEdit &&
                  pageEdit.rename === page.name;
                if (isDuplicating) {
                  // Seed with `[name]-copy` and select just the "-copy"
                  // portion so the user can retype it instantly.
                  const seed = `${page.name}-copy`;
                  return (
                    <li key={page.name}>
                      <PageNameInput
                        initialValue={seed}
                        existingNames={existingPageNames}
                        selectRange={[page.name.length, seed.length]}
                        onConfirm={(name) => void handleDuplicatePage(page.name, name)}
                        onCancel={resetPageEdit}
                        error={pageEditError}
                        busy={pageEditBusy}
                      />
                    </li>
                  );
                }
                if (isRenaming) {
                  // Exclude the current name from collision checks so
                  // "rename home → home" surfaces as an explicit no-op
                  // from the IPC rather than as a spurious collision.
                  const otherNames = existingPageNames.filter(
                    (n) => n !== page.name
                  );
                  return (
                    <li key={page.name}>
                      <PageNameInput
                        initialValue={page.name}
                        existingNames={otherNames}
                        onConfirm={(name) => void handleRenamePage(page.name, name)}
                        onCancel={resetPageEdit}
                        error={pageEditError}
                        busy={pageEditBusy}
                      />
                    </li>
                  );
                }
                return (
                  <li key={page.name}>
                    <button
                      className={`${styles.pageButton} ${
                        activePageName === page.name ? styles.pageActive : ''
                      }`}
                      onClick={() => {
                        if (isEditingPage) return;
                        setActivePageName(page.name);
                      }}
                      onContextMenu={(e) => openPageMenu(e, page.name)}
                      type="button"
                    >
                      {page.name}
                    </button>
                  </li>
                );
              })}
              {pageEdit === 'new' && (
                <li>
                  <PageNameInput
                    existingNames={existingPageNames}
                    onConfirm={(name) => void handleAddPage(name)}
                    onCancel={resetPageEdit}
                    error={pageEditError}
                    busy={pageEditBusy}
                  />
                </li>
              )}
            </ul>
            {pageEdit !== 'new' && (
              <button
                className={styles.addPageButton}
                onClick={() => {
                  if (isEditingPage) return;
                  setPageEditError(null);
                  setPageEdit('new');
                }}
                type="button"
              >
                + Add Page
              </button>
            )}
          </div>
          <div className={`${styles.sidebarSection} ${styles.sidebarLayers}`}>
            <h2 className={styles.sidebarTitle}>Layers</h2>
            <ElementTree />
          </div>
        </aside>
        <Viewport artboardBackground={projectConfig.artboardBackground} />
        <PropertiesPanel />
      </div>
      {bottomPanel === 'code' && <CodePanel />}
      {/*
       * The terminal panel mounts on first open and stays mounted until
       * the project changes. We pass `hidden` so the active panel
       * toggle still controls visibility, but the inner pty processes
       * keep running between toggles.
       */}
      {terminalEverOpened && (
        <TerminalPanel
          key={project.path}
          cwd={project.path}
          hidden={bottomPanel !== 'terminal'}
        />
      )}
      {showThemePanel && (
        <ThemePanel
          projectPath={project.path}
          onClose={() => setShowThemePanel(false)}
        />
      )}
      {showProjectSettings && (
        <ProjectSettingsPage
          projectName={project.name}
          projectPath={project.path}
          config={projectConfig}
          onChange={handleProjectConfigChange}
          onBack={() => setShowProjectSettings(false)}
        />
      )}
      {pageMenu && (
        <PageContextMenu
          x={pageMenu.x}
          y={pageMenu.y}
          items={buildMenuItems(pageMenu.pageName)}
          onClose={() => setPageMenu(null)}
        />
      )}
      {deletingPageName && (
        <ConfirmDialog
          title={`Delete page "${deletingPageName}"?`}
          message={`This will remove ${deletingPageName}.tsx and ${deletingPageName}.module.css from your project folder. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={() => void handleDeletePage(deletingPageName)}
          onCancel={() => setDeletingPageName(null)}
        />
      )}
    </div>
  );
};
