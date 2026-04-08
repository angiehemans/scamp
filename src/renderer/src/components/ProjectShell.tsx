import { useEffect, useState } from 'react';
import type { ProjectData, PageFile } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { parseCode } from '@lib/parseCode';
import { Viewport } from '../canvas/Viewport';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { CodePanel } from './CodePanel';
import { TerminalPanel } from './TerminalPanel';
import { ElementTree } from './ElementTree';
import { ZoomControls } from './ZoomControls';
import styles from './ProjectShell.module.css';

type Props = {
  project: ProjectData;
  onClose: () => void;
};

export const ProjectShell = ({ project, onClose }: Props): JSX.Element => {
  const [activePageName, setActivePageName] = useState<string | null>(
    project.pages[0]?.name ?? null
  );
  const loadPage = useCanvasStore((s) => s.loadPage);
  const resetForNewPage = useCanvasStore((s) => s.resetForNewPage);
  const bottomPanel = useCanvasStore((s) => s.bottomPanel);
  const setBottomPanel = useCanvasStore((s) => s.setBottomPanel);

  // Once the user opens the terminal we keep TerminalPanel mounted for
  // the lifetime of the project, even when the panel is hidden, so any
  // long-running pty processes (Claude Code, dev servers, watches…)
  // survive being toggled out of view.
  const [terminalEverOpened, setTerminalEverOpened] = useState(false);
  useEffect(() => {
    if (bottomPanel === 'terminal') setTerminalEverOpened(true);
  }, [bottomPanel]);
  // Reset the "ever opened" flag when the project changes so a fresh
  // project starts with no background pty processes.
  useEffect(() => {
    setTerminalEverOpened(false);
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
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // toggleTerminalPanel and duplicateElement are read fresh from the
    // store on every keystroke, so this listener doesn't need to re-bind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <button className={styles.backButton} onClick={onClose} type="button">
          ← Projects
        </button>
        <Toolbar />
        <span className={styles.spacer} />
        <ZoomControls />
        <button
          className={`${styles.toggleButton} ${
            bottomPanel === 'code' ? styles.toggleActive : ''
          }`}
          onClick={toggleCodePanel}
          type="button"
          title="Toggle code panel"
        >
          Code {bottomPanel === 'code' ? '▾' : '▸'}
        </button>
        <button
          className={`${styles.toggleButton} ${
            bottomPanel === 'terminal' ? styles.toggleActive : ''
          }`}
          onClick={toggleTerminalPanel}
          type="button"
          title="Toggle terminal (Ctrl+`)"
        >
          Terminal {bottomPanel === 'terminal' ? '▾' : '▸'}
        </button>
        <span className={styles.projectName}>{project.name}</span>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h2 className={styles.sidebarTitle}>Pages</h2>
            <ul className={styles.pageList}>
              {project.pages.map((page) => (
                <li key={page.name}>
                  <button
                    className={`${styles.pageButton} ${
                      activePageName === page.name ? styles.pageActive : ''
                    }`}
                    onClick={() => setActivePageName(page.name)}
                    type="button"
                  >
                    {page.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${styles.sidebarSection} ${styles.sidebarLayers}`}>
            <h2 className={styles.sidebarTitle}>Layers</h2>
            <ElementTree />
          </div>
        </aside>
        <Viewport />
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
    </div>
  );
};
