import { useCanvasStore } from '@store/canvasSlice';
import { Tooltip } from './controls/Tooltip';
import styles from './ZoomControls.module.css';

/**
 * Compact zoom indicator + buttons for the toolbar header.
 *
 * - Shows the current zoom percentage when the user has set an explicit
 *   zoom (via Cmd+= / Cmd+- or the buttons).
 * - Shows "Fit" when the viewport is in auto-fit-to-container mode.
 * - Clicking the percentage label resets to fit. The minus and plus
 *   buttons walk the discrete zoom ladder up and down.
 */
export const ZoomControls = (): JSX.Element => {
  const userZoom = useCanvasStore((s) => s.userZoom);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const resetZoom = useCanvasStore((s) => s.resetZoom);

  const label = userZoom === null ? 'Fit' : `${Math.round(userZoom * 100)}%`;

  return (
    <div className={styles.controls}>
      <Tooltip label="Zoom out (Ctrl/Cmd+-)">
        <button className={styles.button} onClick={() => zoomOut()} type="button">
          −
        </button>
      </Tooltip>
      <Tooltip label="Reset zoom to fit (Ctrl/Cmd+0)">
        <button className={styles.label} onClick={() => resetZoom()} type="button">
          {label}
        </button>
      </Tooltip>
      <Tooltip label="Zoom in (Ctrl/Cmd+=)">
        <button className={styles.button} onClick={() => zoomIn()} type="button">
          +
        </button>
      </Tooltip>
    </div>
  );
};
