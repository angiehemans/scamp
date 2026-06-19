import { type RefObject } from 'react';

import type { ProjectConfig } from '@shared/types';
import { DEFAULT_COMPONENT_CANVAS_SIZE } from '@shared/types';
import { useCanvasStore } from '@store/canvasSlice';
import { useSnapshotsStore } from '@store/snapshotsSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { Viewport } from '@renderer/src/canvas/Viewport';

import { CanvasSizeControl } from '../CanvasSizeControl';
import { Toolbar } from '../Toolbar';
import type { ActiveComponent } from './types';
import styles from '../ProjectShell.module.css';

type Props = {
  activeComponent: ActiveComponent | null;
  activePageName: string | null;
  projectConfig: ProjectConfig;
  artboardScrollRef: RefObject<HTMLDivElement>;
  onProjectConfigChange: (next: ProjectConfig) => void;
  onExitComponentEditor: () => void;
  onOpenSettings: () => void;
  onOpenTheme: () => void;
};

/**
 * The artboard column: component-editor banner + breadcrumb, the canvas
 * size control, the scrollable Viewport, and the element toolbar. Page
 * mode uses the project-wide canvas width; component mode uses the
 * per-component canvas size and enables drag-handle resize.
 */
export const CanvasArea = ({
  activeComponent,
  activePageName,
  projectConfig,
  artboardScrollRef,
  onProjectConfigChange,
  onExitComponentEditor,
  onOpenSettings,
  onOpenTheme,
}: Props): JSX.Element => {
  const snapshotPreview = useCanvasStore((s) => s.snapshotPreview);

  const handleRestorePreview = (): void => {
    void useSnapshotsStore.getState().restorePreview();
  };
  const handleExitPreview = (): void => {
    useCanvasStore.getState().exitSnapshotPreview();
  };

  return (
    <div className={styles.artboard}>
      <div
        ref={artboardScrollRef}
        className={styles.artboardScroll}
        style={{ backgroundColor: projectConfig.artboardBackground }}
      >
        <div className={styles.canvasContent}>
          {snapshotPreview !== null && (
            <div
              className={styles.snapshotPreviewBanner}
              data-testid="snapshot-preview-banner"
            >
              <span>
                Previewing snapshot:{' '}
                <strong>{snapshotPreview.label}</strong>. The canvas is
                read-only — restoring replaces all project files.
              </span>
              <div className={styles.snapshotPreviewActions}>
                <button
                  type="button"
                  className={styles.snapshotPreviewRestore}
                  onClick={handleRestorePreview}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className={styles.snapshotPreviewExit}
                  onClick={handleExitPreview}
                >
                  Exit
                </button>
              </div>
            </div>
          )}
          {activeComponent !== null && (
            <div
              className={styles.componentEditorBanner}
              data-testid="component-editor-banner"
            >
              <span>
                Editing component:{' '}
                <strong>{activeComponent.name}</strong>. Changes
                affect all instances.
              </span>
              <button
                type="button"
                className={styles.componentEditorExit}
                onClick={onExitComponentEditor}
              >
                Exit
              </button>
            </div>
          )}
          <div className={styles.canvasHeader}>
            {activeComponent !== null ? (
              // Breadcrumb: "<return page> > <component>" when
              // entered from a page, otherwise just the
              // component name. Clicking a non-current segment
              // navigates back to it; clicking the current
              // segment selects the root element same as the
              // page badge.
              <div
                className={styles.canvasHeaderBadge}
                role="navigation"
                aria-label="Component editor breadcrumb"
              >
                {activeComponent.returnToPage !== null && (
                  <>
                    <button
                      type="button"
                      className={styles.canvasBreadcrumbLink}
                      onClick={onExitComponentEditor}
                    >
                      {activeComponent.returnToPage}
                    </button>
                    <span aria-hidden="true">{' › '}</span>
                  </>
                )}
                <button
                  type="button"
                  className={styles.canvasBreadcrumbCurrent}
                  onClick={() =>
                    useCanvasStore
                      .getState()
                      .selectElement(ROOT_ELEMENT_ID)
                  }
                  title="Select component root"
                >
                  {activeComponent.name}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.canvasHeaderBadge}
                onClick={() =>
                  useCanvasStore
                    .getState()
                    .selectElement(ROOT_ELEMENT_ID)
                }
                title="Select page root"
              >
                {activePageName ?? 'Page'}
              </button>
            )}
            <span className={styles.canvasHeaderSpacer} />
            <CanvasSizeControl
              config={projectConfig}
              onChange={onProjectConfigChange}
              componentName={
                activeComponent !== null
                  ? activeComponent.name
                  : undefined
              }
            />
          </div>
          <Viewport
            canvasWidth={
              activeComponent !== null
                ? (projectConfig.componentCanvas?.[activeComponent.name]
                    ?.width ?? DEFAULT_COMPONENT_CANVAS_SIZE.width)
                : projectConfig.canvasWidth
            }
            canvasHeight={
              activeComponent !== null
                ? (projectConfig.componentCanvas?.[activeComponent.name]
                    ?.height ?? DEFAULT_COMPONENT_CANVAS_SIZE.height)
                : undefined
            }
            canvasOverflowHidden={projectConfig.canvasOverflowHidden}
            scrollContainerRef={artboardScrollRef}
            // Drag-handle resize is enabled only in component
            // mode; the page canvas uses the project-wide
            // `canvasWidth` setting (no resize handle, no
            // explicit height — page canvases grow with
            // content).
            onResize={
              activeComponent !== null
                ? (width, height) => {
                    const name = activeComponent.name;
                    const nextMap = {
                      ...(projectConfig.componentCanvas ?? {}),
                      [name]: { width, height },
                    };
                    onProjectConfigChange({
                      ...projectConfig,
                      componentCanvas: nextMap,
                    });
                  }
                : undefined
            }
          />
        </div>
      </div>
      <div className={styles.elementToolbar}>
        <Toolbar
          onOpenSettings={onOpenSettings}
          onOpenTheme={onOpenTheme}
        />
      </div>
    </div>
  );
};
