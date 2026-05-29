import { useEffect, useMemo, useRef, useState } from 'react';
import { useSaveStatusStore, type SaveState } from '@store/saveStatusSlice';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { formatHistoryLabel } from '@store/formatHistoryLabel';
import {
  discardDivergedCanvas,
  resumeFromPause,
  retryLastSave,
  saveDivergedCanvas,
} from '../syncBridge';
import styles from './SaveStatusIndicator.module.css';

/** Cap on how many recent edits the diverged popover lists. Above
 *  this the popover would scroll; better to show "+ N more." */
const MAX_DIFF_ENTRIES = 5;

/**
 * Header indicator showing whether canvas edits are in sync with disk.
 * Driven by `useSaveStatusStore`. Six states:
 *
 *   - saved        — canvas == disk.
 *   - unsaved      — canvas has uncommitted edits, debounce pending.
 *   - saving       — write IPC in flight.
 *   - error        — write failed (generic IPC failure); retryable.
 *   - paused       — sync engine intentionally suspended writes
 *                    because an external editor is touching project
 *                    files. Canvas edits queue in memory. Click to
 *                    expand for a `Resume now` override.
 *   - diverged     — pause cleared; canvas + disk don't match;
 *                    user picks Save canvas or Discard canvas.
 *   - reloaded-from-disk
 *                  — last write hit a conflict and Scamp adopted
 *                    disk; user's in-flight edit was discarded. NOT
 *                    retryable.
 *
 * `paused`, `diverged`, and `reloaded-from-disk` are clickable to
 * open the popover. The popover's action buttons are wired in
 * Phase 3 (Resume) and Phase 5 (Save / Discard).
 */
export const SaveStatusIndicator = (): JSX.Element => {
  const state = useSaveStatusStore((s) => s.state);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  // Close the popover when state transitions to a non-interactive
  // value (e.g. saved). Saves the user from a stale popover hanging
  // around after the underlying condition cleared.
  useEffect(() => {
    if (!isInteractive(state)) setPopoverOpen(false);
  }, [state]);

  // Dismiss the popover on a click anywhere outside its host span.
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent): void => {
      if (
        wrapRef.current &&
        e.target instanceof Node &&
        !wrapRef.current.contains(e.target)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverOpen]);

  const interactive = isInteractive(state);
  return (
    <span ref={wrapRef} className={styles.wrap}>
      {renderPill(state, interactive, () => setPopoverOpen((v) => !v))}
      {popoverOpen && interactive && (
        <span className={styles.popover} role="dialog">
          {renderPopover(state)}
        </span>
      )}
    </span>
  );
};

const isInteractive = (state: SaveState): boolean =>
  state.kind === 'paused' ||
  state.kind === 'diverged' ||
  state.kind === 'reloaded-from-disk';

const renderPill = (
  state: SaveState,
  interactive: boolean,
  onClick: () => void
): JSX.Element => {
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
        <span
          className={`${styles.glyph} ${styles.spinner}`}
          aria-hidden="true"
        >
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

  if (state.kind === 'error') {
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
  }

  if (state.kind === 'paused') {
    return (
      <button
        type="button"
        className={`${styles.indicator} ${styles.paused} ${styles.button}`}
        aria-live="polite"
        aria-expanded={interactive ? 'false' : undefined}
        data-testid="save-status"
        data-status="paused"
        onClick={onClick}
      >
        <span className={styles.glyph} aria-hidden="true">
          ⏸
        </span>
        Paused
      </button>
    );
  }

  if (state.kind === 'diverged') {
    return (
      <button
        type="button"
        className={`${styles.indicator} ${styles.diverged} ${styles.button}`}
        aria-live="assertive"
        data-testid="save-status"
        data-status="diverged"
        onClick={onClick}
      >
        <span className={styles.glyph} aria-hidden="true">
          ⚠
        </span>
        Diverged
      </button>
    );
  }

  // reloaded-from-disk
  return (
    <button
      type="button"
      className={`${styles.indicator} ${styles.reloaded} ${styles.button}`}
      aria-live="polite"
      data-testid="save-status"
      data-status="reloaded-from-disk"
      onClick={onClick}
    >
      <span className={styles.glyph} aria-hidden="true">
        ↺
      </span>
      Reloaded
    </button>
  );
};

/**
 * Diverged-state popover. Splits out into its own component because
 * it needs `useHistoryStore` / `useCanvasStore` subscriptions — the
 * other popover branches are stateless. Lists the canvas edits that
 * happened DURING the pause so the user can decide between Save
 * canvas and Discard canvas with a clear picture of what's at stake.
 */
const DivergedPopoverBody = (): JSX.Element => {
  const pauseStartedAt = useSaveStatusStore((s) => s.pauseStartedAt);
  const activePageId = useHistoryStore((s) => s.activePageId);
  const pageHistory = useHistoryStore((s) =>
    activePageId ? s.perPage[activePageId] : undefined
  );
  const elements = useCanvasStore((s) => s.elements);

  const recentEntries = useMemo(() => {
    if (!pageHistory) return [];
    const since = pauseStartedAt ?? 0;
    // Filter to entries created during the pause, then take the
    // most recent N (the rest fold into the "+ N more" footer).
    return pageHistory.entries.filter((e) => e.timestamp >= since);
  }, [pageHistory, pauseStartedAt]);

  const visible = recentEntries.slice(-MAX_DIFF_ENTRIES).reverse();
  const overflow = Math.max(0, recentEntries.length - visible.length);

  return (
    <>
      <p className={styles.popoverBody}>
        Your canvas changes haven&apos;t been saved because the file was
        edited externally. Choose which version to keep.
      </p>
      {visible.length > 0 && (
        <div className={styles.divergedDiff}>
          <div className={styles.divergedDiffHeader}>
            Canvas changes since the pause:
          </div>
          <ul className={styles.divergedDiffList}>
            {visible.map((entry) => (
              <li key={entry.id}>{formatHistoryLabel(entry, elements)}</li>
            ))}
            {overflow > 0 && (
              <li className={styles.divergedDiffOverflow}>
                + {overflow} more
              </li>
            )}
          </ul>
        </div>
      )}
      <div className={styles.popoverActions}>
        <button
          type="button"
          className={styles.popoverButton}
          onClick={() => saveDivergedCanvas()}
        >
          Save canvas
        </button>
        <button
          type="button"
          className={styles.popoverButton}
          onClick={() => discardDivergedCanvas()}
        >
          Discard canvas
        </button>
      </div>
    </>
  );
};

const renderPopover = (state: SaveState): JSX.Element | null => {
  if (state.kind === 'paused') {
    return (
      <>
        <p className={styles.popoverBody}>
          {state.reason === 'agent-terminal'
            ? 'Sync paused — an agent is running in the terminal. Canvas edits will queue until it stops writing.'
            : 'Sync paused — an external editor is writing to project files. Canvas edits will queue until activity settles.'}
        </p>
        <div className={styles.popoverActions}>
          <button
            type="button"
            className={styles.popoverButton}
            onClick={() => resumeFromPause()}
          >
            Resume now
          </button>
        </div>
      </>
    );
  }
  if (state.kind === 'diverged') {
    return <DivergedPopoverBody />;
  }
  if (state.kind === 'reloaded-from-disk') {
    return (
      <p className={styles.popoverBody}>
        <code>{state.file}</code> was edited externally while Scamp was
        saving. The canvas was reloaded from disk; any in-flight edit was
        dropped.
      </p>
    );
  }
  return null;
};
