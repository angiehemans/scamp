import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  COMPONENT_THUMBNAIL_UPDATED_EVENT,
  type ComponentThumbnailUpdatedDetail,
} from '../lib/componentThumbnail';
import styles from './ComponentSidebarItem.module.css';
import projectStyles from './ProjectShell.module.css';

type Props = {
  componentName: string;
  projectPath: string;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
};

/**
 * Phase 9 — one row of the components sidebar. Holds its own
 * thumbnail state so re-renders of the parent don't bounce the
 * image's loading lifecycle. On mount and on every
 * `scamp:component-thumbnail-updated` event for THIS component,
 * we re-fetch the on-disk PNG (the watcher ignores `.scamp/` so
 * the custom event is the canonical refresh signal). Components
 * that have never been edited / opened in the editor render a
 * placeholder dashed-box icon so the row layout stays consistent.
 */
export const ComponentSidebarItem = ({
  componentName,
  projectPath,
  isActive,
  onClick,
  onContextMenu,
  onDragStart,
}: Props): JSX.Element => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const result = await window.scamp.readComponentThumbnail({
          projectPath,
          componentName,
        });
        if (cancelled) return;
        setThumbnailUrl(
          result.base64 ? `data:image/png;base64,${result.base64}` : null
        );
      } catch {
        if (!cancelled) setThumbnailUrl(null);
      }
    };
    void load();

    const handler = (e: Event): void => {
      const detail = (e as CustomEvent<ComponentThumbnailUpdatedDetail>).detail;
      if (!detail) return;
      if (detail.componentName !== componentName) return;
      void load();
    };
    window.addEventListener(COMPONENT_THUMBNAIL_UPDATED_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(COMPONENT_THUMBNAIL_UPDATED_EVENT, handler);
    };
  }, [componentName, projectPath]);

  return (
    <button
      className={`${projectStyles.pageButton} ${styles.row} ${
        isActive ? projectStyles.pageActive : ''
      }`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      type="button"
      draggable
      onDragStart={onDragStart}
    >
      {thumbnailUrl !== null ? (
        <img
          className={styles.thumbnail}
          src={thumbnailUrl}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span className={styles.placeholder} aria-hidden="true" />
      )}
      <span className={styles.label}>{componentName}</span>
    </button>
  );
};
