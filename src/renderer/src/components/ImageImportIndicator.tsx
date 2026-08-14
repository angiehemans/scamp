import { useCanvasStore } from '@store/canvasSlice';

import styles from './ImageImportIndicator.module.css';

/**
 * "Optimising image…" while an import converts.
 *
 * The conversion runs in a child process, so nothing is actually
 * blocked — but a large photo takes a second or two, and silence for
 * that long reads as a hang rather than as work.
 * see docs/plans/image-import-speed-plan.md
 */
export const ImageImportIndicator = (): JSX.Element | null => {
  const busy = useCanvasStore((s) => s.imageImportBusy);
  if (!busy) return null;
  return (
    <div className={styles.pill} role="status" data-testid="image-import-busy">
      <span className={styles.spinner} aria-hidden="true" />
      Optimising image…
    </div>
  );
};
