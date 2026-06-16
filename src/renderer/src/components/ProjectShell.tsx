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
// Render is split into ProjectHeader / CanvasArea (+ the sidebar lists and
// modals still inline here for now).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectData } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { flushPendingPageWrite } from '../syncBridge';
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
import { ConfirmDialog } from './ConfirmDialog';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { ProjectHeader } from './projectShell/ProjectHeader';
import { CanvasArea } from './projectShell/CanvasArea';
import { useCanvasKeyboardShortcuts } from './projectShell/useCanvasKeyboardShortcuts';
import { useProjectConfig } from './projectShell/useProjectConfig';
import { useProjectStoreSync } from './projectShell/useProjectStoreSync';
import {
  useFontLinkReconciler,
  useProjectTheme,
} from './projectShell/useProjectFonts';
import { useActiveTarget } from './projectShell/useActiveTarget';
import { usePageManagement } from './projectShell/usePageManagement';
import { useComponentManagement } from './projectShell/useComponentManagement';
import { useInstanceFlows } from './projectShell/useInstanceFlows';
import { useLatest } from './projectShell/useLatest';
import styles from './ProjectShell.module.css';

type Props = {
  project: ProjectData;
  onClose: () => void;
  /**
   * Called after a page or component change. Accepts either a
   * replacement `ProjectData` OR a functional updater that
   * receives the latest committed state. Multi-step handlers
   * (convert-to-component, rename, etc.) MUST use the functional
   * form so sequential calls compose against React's queued
   * state instead of stomping each other via stale closure refs.
   */
  onProjectChange?: (
    next: ProjectData | ((prev: ProjectData) => ProjectData)
  ) => void;
};

export const ProjectShell = ({
  project,
  onClose,
  onProjectChange,
}: Props): JSX.Element => {
  // Per-project config (scamp.config.json) + its canvas-store breakpoint
  // mirror, owned by the hook. Defaults render immediately so the canvas
  // doesn't flash a wrong background while the first read is in flight.
  const { projectConfig, handleProjectConfigChange } = useProjectConfig(
    project.path
  );
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  // Ref to the artboard scroll container. Passed to `Viewport` so
  // fit-to-width zoom can observe the real scroll area, and used here
  // for the click-to-deselect handler on empty canvas space.
  const artboardScrollRef = useRef<HTMLDivElement>(null);

  // Which page or component is open + the load pipeline, parse-error /
  // migration banner state, source persistence, and component enter/exit.
  const {
    activePageName,
    setActivePageName,
    activeComponent,
    setActiveComponentState,
    parseError,
    clearParseError,
    showMigrationBanner,
    handleDismissMigrationBanner,
    persistActiveSource,
    openComponent,
    exitComponentEditor,
    latestExit,
  } = useActiveTarget({
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
  const {
    existingPageNames,
    pageEdit,
    setPageEdit,
    pageEditBusy,
    pageEditError,
    setPageEditError,
    isEditingPage,
    resetPageEdit,
    handleAddPage,
    handleDuplicatePage,
    handleRenamePage,
    openPageMenu,
    buildMenuItems,
    pageMenu,
    closePageMenu,
    deletingPageName,
    setDeletingPageName,
    deletePageError,
    setDeletePageError,
    handleDeletePage,
  } = usePageManagement({
    project,
    onProjectChange,
    activePageName,
    setActivePageName,
    persistActiveSource,
  });

  // Components sidebar inline-edit / context-menu state + the multi-file
  // add / rename / delete handlers.
  const {
    componentEdit,
    setComponentEdit,
    componentEditError,
    setComponentEditError,
    creatingComponent,
    renamingComponent,
    handleAddComponent,
    handleRenameComponent,
    openComponentMenu,
    componentMenu,
    closeComponentMenu,
    requestDeleteComponent,
    deletingComponent,
    setDeletingComponent,
    componentDeleteBusy,
    handleConfirmDeleteComponent,
  } = useComponentManagement({
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
    if (bottomPanel === 'terminal') setTerminalEverOpened(true);
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
    if (!node) return;
    const handler = (e: MouseEvent): void => {
      if (e.target === node) {
        useCanvasStore.getState().selectElement(null);
      }
    };
    node.addEventListener('mousedown', handler);
    return () => node.removeEventListener('mousedown', handler);
  }, []);

  const toggleCodePanel = (): void => {
    setBottomPanel(bottomPanel === 'code' ? 'none' : 'code');
  };

  const toggleTerminalPanel = (): void => {
    setBottomPanel(bottomPanel === 'terminal' ? 'none' : 'terminal');
  };

  // Preview is gated on the nextjs project format — legacy projects
  // don't have a `package.json` and can't run `next dev`. The button
  // stays visible (so users discover the feature) but is disabled
  // with a tooltip pointing at the migration banner.
  const projectFormatForPreview = useCanvasStore((s) => s.projectFormat);
  const projectPathForPreview = useCanvasStore((s) => s.projectPath);
  const canPreview =
    projectFormatForPreview === 'nextjs' &&
    projectPathForPreview.length > 0 &&
    activePageName !== null;

  const openPreview = useCallback((): void => {
    if (!canPreview || activePageName === null) return;
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
    if (!canPreview || activePageName === null) return;
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

  // Local binding so the `!== null` guard narrows it for the dialog's
  // onConfirm closure (a property access wouldn't narrow).
  const convertElementId = instanceFlows.convertElementId;

  return (
    <div className={styles.shell}>
      <ProjectHeader
        projectName={project.name}
        bottomPanel={bottomPanel}
        canPreview={canPreview}
        projectFormat={projectFormatForPreview}
        onClose={onClose}
        onToggleCode={toggleCodePanel}
        onToggleTerminal={toggleTerminalPanel}
        onOpenPreview={openPreview}
      />
      <SaveStatusToast />
      {showMigrationBanner && (
        <MigrationBanner onDismiss={handleDismissMigrationBanner} />
      )}
      {parseError && (
        <ParseErrorBanner
          targetName={parseError.targetName}
          onDismiss={clearParseError}
        />
      )}
      {project.format === 'legacy' && !projectConfig.nextjsMigrationDismissed && (
        <NextjsMigrationBanner
          project={project}
          onMigrated={(next) => {
            // Project flips to nextjs format — refresh upward and pick
            // the home page so the renderer doesn't try to render a
            // page whose paths just changed under it.
            onProjectChange?.(next);
            setActivePageName(next.pages[0]?.name ?? null);
          }}
          onDismiss={() =>
            handleProjectConfigChange({
              ...projectConfig,
              nextjsMigrationDismissed: true,
            })
          }
        />
      )}
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTabStrip} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={leftSidebarTab === 'layers'}
              className={`${styles.sidebarTab} ${
                leftSidebarTab === 'layers' ? styles.sidebarTabActive : ''
              }`}
              onClick={() => setLeftSidebarTab('layers')}
            >
              Pages & Layers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftSidebarTab === 'history'}
              className={`${styles.sidebarTab} ${
                leftSidebarTab === 'history' ? styles.sidebarTabActive : ''
              }`}
              onClick={() => setLeftSidebarTab('history')}
            >
              History
            </button>
          </div>
          {leftSidebarTab === 'history' && <HistoryPanel />}
          {leftSidebarTab === 'layers' && <>
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
                        activeComponent === null &&
                        activePageName === page.name
                          ? styles.pageActive
                          : ''
                      }`}
                      onClick={() => {
                        if (isEditingPage) return;
                        // Clicking the same page that's already
                        // active is a no-op for state but we
                        // still want to keep the early-return so
                        // we don't pointlessly thrash the project
                        // snapshot.
                        const sameTargetClicked =
                          activeComponent === null &&
                          activePageName === page.name;
                        if (sameTargetClicked) return;
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
          <div className={styles.sidebarSection}>
            <h2 className={styles.sidebarTitle}>Components</h2>
            <ul className={styles.pageList}>
              {project.components.map((component) => {
                const isRenaming =
                  componentEdit !== null &&
                  componentEdit !== 'new' &&
                  componentEdit.rename === component.name;
                if (isRenaming) {
                  return (
                    <li key={component.name}>
                      <ComponentNameInput
                        initialValue={component.name}
                        existingNames={project.components
                          .map((c) => c.name)
                          .filter((n) => n !== component.name)}
                        onConfirm={(name) =>
                          void handleRenameComponent(component.name, name)
                        }
                        onCancel={() => {
                          if (renamingComponent) return;
                          setComponentEdit(null);
                          setComponentEditError(null);
                        }}
                        error={componentEditError}
                        busy={renamingComponent}
                      />
                    </li>
                  );
                }
                return (
                  <li key={component.name}>
                    <ComponentSidebarItem
                      componentName={component.name}
                      projectPath={project.path}
                      isActive={activeComponent?.name === component.name}
                      onClick={() => openComponent(component.name, null)}
                      onContextMenu={(e) =>
                        openComponentMenu(e, component.name)
                      }
                      // HTML5 DnD source: dragging a component onto
                      // the canvas inserts an instance there. The
                      // Viewport's drop handler reads this
                      // dataTransfer mime to distinguish a
                      // component-drag from any other drag.
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/x-scamp-component',
                          component.name
                        );
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    />
                  </li>
                );
              })}
              {componentEdit === 'new' && (
                <li>
                  <ComponentNameInput
                    existingNames={project.components.map((c) => c.name)}
                    onConfirm={(name) => void handleAddComponent(name)}
                    onCancel={() => {
                      setComponentEdit(null);
                      setComponentEditError(null);
                    }}
                    error={componentEditError}
                    busy={creatingComponent}
                  />
                </li>
              )}
            </ul>
            {componentEdit === null && (
              <button
                className={styles.addPageButton}
                onClick={() => {
                  setComponentEditError(null);
                  setComponentEdit('new');
                }}
                type="button"
              >
                + Add Component
              </button>
            )}
          </div>
          <div
            className={`${styles.sidebarSection} ${styles.sidebarLayers}`}
            data-testid="layers-panel"
          >
            <h2 className={styles.sidebarTitle}>Layers</h2>
            <ElementTree />
          </div>
          </>}
        </aside>
        <CanvasArea
          activeComponent={activeComponent}
          activePageName={activePageName}
          projectConfig={projectConfig}
          artboardScrollRef={artboardScrollRef}
          onProjectConfigChange={handleProjectConfigChange}
          onExitComponentEditor={exitComponentEditor}
          onOpenSettings={() => setShowProjectSettings(true)}
          onOpenTheme={() => setShowThemePanel(true)}
        />
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
          onClose={closePageMenu}
        />
      )}
      {componentMenu && (
        <PageContextMenu
          x={componentMenu.x}
          y={componentMenu.y}
          items={[
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
          ]}
          onClose={closeComponentMenu}
        />
      )}
      <ElementContextMenu />

      {deletingPageName && (
        <ConfirmDialog
          title={`Delete page "${deletingPageName}"?`}
          message={`This will remove ${deletingPageName}.tsx and ${deletingPageName}.module.css from your project folder. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="destructive"
          error={deletePageError}
          onConfirm={() => void handleDeletePage(deletingPageName)}
          onCancel={() => {
            setDeletingPageName(null);
            setDeletePageError(null);
          }}
        />
      )}

      {convertElementId !== null && (
        <CreateComponentDialog
          existingNames={project.components.map((c) => c.name)}
          error={instanceFlows.convertError}
          busy={instanceFlows.convertingComponent}
          onConfirm={(name) =>
            void instanceFlows.handleConvertToComponent(convertElementId, name)
          }
          onCancel={instanceFlows.cancelConvert}
        />
      )}

      {instanceFlows.lockPropRequest !== null && (
        <ConfirmDialog
          title={`Lock "${instanceFlows.lockPropRequest.propName}"?`}
          message={`This will drop the override on ${instanceFlows.lockPropRequest.impactByPage
            .map(
              (g) =>
                `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`
            )
            .join(', ')}. The component-side default will render in their place.`}
          confirmLabel="Lock prop"
          variant="destructive"
          onConfirm={instanceFlows.handleConfirmLockProp}
          onCancel={instanceFlows.cancelLockProp}
        />
      )}

      {deletingComponent !== null && (
        <ConfirmDialog
          title={`Delete component "${deletingComponent.componentName}"?`}
          message={
            deletingComponent.impactByPage.length === 0
              ? `Removes the components/${deletingComponent.componentName}/ folder. No instances on any page.`
              : `Removes the components/${deletingComponent.componentName}/ folder AND every instance from: ${deletingComponent.impactByPage
                  .map(
                    (g) =>
                      `${g.pageName} (${g.count} instance${g.count === 1 ? '' : 's'})`
                  )
                  .join(', ')}. This cannot be undone.`
          }
          confirmLabel={componentDeleteBusy ? 'Deleting…' : 'Delete component'}
          variant="destructive"
          onConfirm={() => void handleConfirmDeleteComponent()}
          onCancel={() => {
            if (componentDeleteBusy) return;
            setDeletingComponent(null);
          }}
        />
      )}

      {instanceFlows.deletePropTextRequest !== null && (
        <ConfirmDialog
          title={
            instanceFlows.deletePropTextRequest.propsAtRisk.length === 1
              ? `Delete prop "${instanceFlows.deletePropTextRequest.propsAtRisk[0]}"?`
              : 'Delete prop text elements?'
          }
          message={`Existing overrides on ${instanceFlows.deletePropTextRequest.impactByPage
            .map(
              (g) =>
                `${g.count} instance${g.count === 1 ? '' : 's'} on ${g.pageName}`
            )
            .join(
              ', '
            )} will no longer have an effect. The pages keep the attribute on disk until they re-save.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={instanceFlows.handleConfirmDeletePropText}
          onCancel={instanceFlows.cancelDeletePropText}
        />
      )}

      {instanceFlows.detachRequest !== null && (
        <ConfirmDialog
          title={`Detach ${instanceFlows.detachRequest.componentName} instance?`}
          message={
            instanceFlows.detachRequest.overrideCount > 0
              ? `The component's design will be copied directly into this page. Future edits to ${instanceFlows.detachRequest.componentName} won't update this copy. Your ${instanceFlows.detachRequest.overrideCount} override${instanceFlows.detachRequest.overrideCount === 1 ? '' : 's'} will be baked in as literal text. This cannot be undone with re-attach.`
              : `The component's design will be copied directly into this page. Future edits to ${instanceFlows.detachRequest.componentName} won't update this copy. This cannot be undone with re-attach.`
          }
          confirmLabel="Detach"
          variant="destructive"
          onConfirm={instanceFlows.handleConfirmDetach}
          onCancel={instanceFlows.cancelDetach}
        />
      )}
    </div>
  );
};
