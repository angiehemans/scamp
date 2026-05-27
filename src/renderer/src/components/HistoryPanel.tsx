import { useEffect, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import {
  selectActivePageHistory,
  useHistoryStore,
} from '@store/historySlice';
import {
  formatHistoryLabel,
  formatRelativeTime,
} from '@store/formatHistoryLabel';
import type { HistoryEntry } from '@store/historyTypes';
import { Tooltip } from './controls/Tooltip';
import styles from './HistoryPanel.module.css';

/**
 * Visual history panel — the second tab in the left sidebar.
 * Renders the active page's history list with the current cursor
 * highlighted. Clicking an entry jumps to that point in history.
 *
 * Past entries (cursor and below in time) display solid; future
 * entries (greyed out, after a divider) are the redoable steps.
 *
 * Per the story spec: clicks are dropped silently while a canvas
 * drag is in flight, so the panel is display-only during drag.
 */
export const HistoryPanel = (): JSX.Element => {
  const history = useHistoryStore(selectActivePageHistory);
  const transactionDepth = useHistoryStore((s) => s.transactionDepth);
  const jumpToHistory = useHistoryStore((s) => s.jumpToHistory);
  const elements = useCanvasStore((s) => s.elements);
  const isDragging = transactionDepth > 0;

  // 30s tick to keep relative timestamps fresh ("just now" → "1
  // min ago" etc.). Only runs while this component is mounted —
  // hidden when the tab isn't active, so no background timer.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();

  // The `'load'` entry is a synthetic baseline that lets `Cmd+Z`
  // return to the file's loaded state — not a user action. Skip it
  // when deciding whether the panel is empty AND when rendering.
  const userEntries = history.entries
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => entry.kind !== 'load');

  if (userEntries.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>No changes made in this session</p>
      </div>
    );
  }

  // Render newest-first (the spec's mock has most-recent at top).
  // `display` is reversed; index in the underlying array is preserved
  // so `jumpToHistory` receives the canonical index.
  const indices: number[] = [];
  for (let i = userEntries.length - 1; i >= 0; i -= 1) {
    indices.push(userEntries[i]!.idx);
  }

  return (
    <div className={styles.panel}>
      <ul className={styles.list}>
        {indices.map((idx, displayIdx) => {
          const entry = history.entries[idx]!;
          const isCurrent = idx === history.cursor;
          const isFuture = idx > history.cursor;
          // Render the past/future divider once — after the first
          // entry whose index is greater than the cursor (i.e. the
          // first future entry in display order).
          const prevDisplay = displayIdx > 0 ? indices[displayIdx - 1]! : null;
          const showDivider =
            prevDisplay !== null &&
            prevDisplay > history.cursor &&
            idx <= history.cursor;
          return (
            <HistoryRow
              key={entry.id}
              entry={entry}
              isCurrent={isCurrent}
              isFuture={isFuture}
              showDivider={showDivider}
              elements={elements}
              now={now}
              // Clicks are suppressed during a canvas drag — the
              // panel is display-only while a transaction is open
              // per the story spec.
              onJump={isDragging ? () => undefined : () => jumpToHistory(idx)}
            />
          );
        })}
      </ul>
    </div>
  );
};

type RowProps = {
  entry: HistoryEntry;
  isCurrent: boolean;
  isFuture: boolean;
  showDivider: boolean;
  elements: Record<string, ReturnType<typeof useCanvasStore.getState>['elements'][string]>;
  now: number;
  onJump: () => void;
};

const HistoryRow = ({
  entry,
  isCurrent,
  isFuture,
  showDivider,
  elements,
  now,
  onJump,
}: RowProps): JSX.Element => {
  const label = formatHistoryLabel(entry, elements);
  const relative = formatRelativeTime(entry.timestamp, now);
  const absolute = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <>
      {showDivider && (
        <li className={styles.divider} aria-hidden="true">
          undone
        </li>
      )}
      <Tooltip label={absolute}>
        <li
          className={[
            styles.row,
            isCurrent ? styles.current : '',
            isFuture ? styles.future : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className={styles.rowButton}
            onClick={onJump}
            disabled={isCurrent}
          >
            <span className={styles.bullet} aria-hidden="true">
              {isCurrent ? '●' : ''}
            </span>
            <span className={styles.label}>{label}</span>
            <span className={styles.timestamp}>{relative}</span>
          </button>
        </li>
      </Tooltip>
    </>
  );
};
