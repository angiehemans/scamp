import { useSaveStatusStore } from '@store/saveStatusSlice';
import { retryLastSave } from '../syncBridge';
import styles from './SaveStatusIndicator.module.css';

/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`, which transitions through
 * saved → unsaved → saving → saved on every edit cycle, or lands in
 * `error` when a write fails. The retry button re-issues the last
 * attempted save.
 */
export const SaveStatusIndicator = (): JSX.Element => {
  const state = useSaveStatusStore((s) => s.state);

  if (state.kind === 'saved') {
    return (
      <span
        className={`${styles.indicator} ${styles.saved}`}
        aria-live="polite"
        data-testid="save-status"
        data-status="saved"
      >
        <span className={styles.glyph} aria-hidden="true">
          ✓
        </span>
        Saved
      </span>
    );
  }

  if (state.kind === 'saving') {
    return (
      <span
        className={`${styles.indicator} ${styles.saving}`}
        aria-live="polite"
        data-testid="save-status"
        data-status="saving"
      >
        <span className={`${styles.glyph} ${styles.spinner}`} aria-hidden="true">
          ↑
        </span>
        Saving…
      </span>
    );
  }

  if (state.kind === 'unsaved') {
    return (
      <span
        className={`${styles.indicator} ${styles.unsaved}`}
        aria-live="polite"
        data-testid="save-status"
        data-status="unsaved"
      >
        <span className={styles.glyph} aria-hidden="true">
          ●
        </span>
        Unsaved
      </span>
    );
  }

  return (
    <span
      className={`${styles.indicator} ${styles.error}`}
      aria-live="assertive"
      data-testid="save-status"
      data-status="error"
    >
      <span className={styles.glyph} aria-hidden="true">
        ⚠
      </span>
      <span className={styles.errorMessage} title={state.message}>
        Save failed
      </span>
      <button
        className={styles.retryButton}
        onClick={() => retryLastSave()}
        type="button"
      >
        Retry
      </button>
    </span>
  );
};
