import { useCanvasStore } from '@store/canvasSlice';
import { classNameFor } from '@lib/generateCode';
import styles from './PropertiesPanel.module.css';

/**
 * The class chip + multi-select badge that sits above the mode toggle.
 * Reads the primary selection straight from the canvas store so the
 * router doesn't have to thread it through props.
 */
export const PanelHeader = (): JSX.Element | null => {
  const element = useCanvasStore((s) => {
    const id = s.selectedElementIds[0];
    return id ? s.elements[id] : undefined;
  });
  const selectionCount = useCanvasStore((s) => s.selectedElementIds.length);

  if (!element) return null;
  const className = classNameFor(element);

  return (
    <div className={styles.header}>
      <span className={styles.label}>Class</span>
      <code className={styles.className}>.{className}</code>
      {selectionCount > 1 && (
        <span className={styles.multiBadge}>+{selectionCount - 1} more</span>
      )}
    </div>
  );
};
