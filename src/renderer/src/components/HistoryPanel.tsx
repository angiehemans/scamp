import { useEffect, useState } from 'react';
import {
  IconArrowBackUp,
  IconBolt,
  IconBookmark,
  IconPlayerPlay,
  IconPlayerStop,
  IconRefresh,
  type Icon,
} from '@tabler/icons-react';

import type { SnapshotMeta } from '@shared/types';
import { useSnapshotsStore } from '@store/snapshotsSlice';
import {
  formatPageCount,
  snapshotsNewestFirst,
  triggerIcon,
  type TriggerIcon,
} from '@store/snapshotDisplay';
import { formatRelativeTime } from '@store/formatHistoryLabel';

import { Tooltip } from './controls/Tooltip';
import { Button } from './controls/Button';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './HistoryPanel.module.css';

type Props = {
  /** Active project root — snapshots are scoped to it. */
  projectPath: string;
};

const TRIGGER_ICON: Record<TriggerIcon, Icon> = {
  'session-open': IconPlayerPlay,
  'session-close': IconPlayerStop,
  agent: IconBolt,
  manual: IconBookmark,
  auto: IconRefresh,
  restore: IconArrowBackUp,
};

/**
 * The History panel — the second tab in the left sidebar. Lists the
 * project's persistent snapshots (newest first) with a "Now" marker for
 * the current state. Clicking a snapshot restores it (after confirming);
 * "Save snapshot" takes a manual one. The in-session Cmd+Z undo stack is
 * independent and unaffected. See docs/notes/snapshots.md.
 */
export const HistoryPanel = ({ projectPath }: Props): JSX.Element => {
  const snapshots = useSnapshotsStore((s) => s.snapshots);
  const loadSnapshots = useSnapshotsStore((s) => s.loadSnapshots);
  const takeSnapshot = useSnapshotsStore((s) => s.takeSnapshot);
  const restoreSnapshot = useSnapshotsStore((s) => s.restoreSnapshot);

  // Refresh the list every time the panel mounts (i.e. the tab is opened)
  // so agent-edit / auto-save snapshots taken while it was hidden appear.
  useEffect(() => {
    void loadSnapshots(projectPath);
  }, [loadSnapshots, projectPath]);

  // 30s tick keeps relative timestamps fresh ("just now" → "1 min ago").
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();

  // Manual-snapshot naming + restore-confirm state.
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [pendingRestore, setPendingRestore] = useState<SnapshotMeta | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleSaveSnapshot = (): void => {
    void takeSnapshot(projectPath, 'manual', name.trim() || undefined);
    setName('');
    setNaming(false);
  };

  const handleConfirmRestore = async (): Promise<void> => {
    if (!pendingRestore) return;
    const res = await restoreSnapshot(projectPath, pendingRestore.id);
    if (res.ok) {
      setPendingRestore(null);
      setRestoreError(null);
    } else {
      setRestoreError(res.error);
    }
  };

  const ordered = snapshotsNewestFirst(snapshots);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {naming ? (
          <input
            className={styles.nameInput}
            autoFocus
            value={name}
            placeholder="Snapshot name (optional)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveSnapshot();
              if (e.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
            onBlur={() => {
              setNaming(false);
              setName('');
            }}
          />
        ) : (
          <Button variant="secondary" fullWidth onClick={() => setNaming(true)}>
            Save snapshot
          </Button>
        )}
      </div>

      <ul className={styles.list}>
        <li className={`${styles.row} ${styles.nowRow}`}>
          <div className={styles.rowButton}>
            <span className={styles.bullet} aria-hidden="true">
              ●
            </span>
            <span className={styles.label}>Now</span>
          </div>
        </li>

        {ordered.length === 0 ? (
          <li>
            <p className={styles.empty}>No snapshots yet</p>
          </li>
        ) : (
          ordered.map((snap) => (
            <SnapshotRow
              key={snap.id}
              snapshot={snap}
              now={now}
              onRestore={() => {
                setRestoreError(null);
                setPendingRestore(snap);
              }}
            />
          ))
        )}
      </ul>

      {pendingRestore && (
        <ConfirmDialog
          title="Restore this snapshot?"
          message={`${pendingRestore.label} — ${formatRelativeTime(
            Date.parse(pendingRestore.timestamp),
            now
          )}\n\nThis will replace all current project files with the snapshot. Your current state will be saved as a new snapshot first.`}
          confirmLabel="Restore"
          cancelLabel="Cancel"
          variant="destructive"
          error={restoreError}
          onConfirm={() => void handleConfirmRestore()}
          onCancel={() => {
            setPendingRestore(null);
            setRestoreError(null);
          }}
        />
      )}
    </div>
  );
};

type RowProps = {
  snapshot: SnapshotMeta;
  now: number;
  onRestore: () => void;
};

const SnapshotRow = ({ snapshot, now, onRestore }: RowProps): JSX.Element => {
  const Icon = TRIGGER_ICON[triggerIcon(snapshot.trigger)];
  const ts = Date.parse(snapshot.timestamp);
  const relative = formatRelativeTime(ts, now);
  const absolute = new Date(ts).toLocaleString();

  return (
    <li className={styles.row}>
      <Tooltip label={absolute}>
        <button type="button" className={styles.rowButton} onClick={onRestore}>
          <span className={styles.icon} aria-hidden="true">
            <Icon size={14} stroke={2} />
          </span>
          <span className={styles.label}>
            {snapshot.label}
            <span className={styles.secondary}>
              {' · '}
              {formatPageCount(snapshot.pageCount)}
            </span>
          </span>
          <span className={styles.timestamp}>{relative}</span>
        </button>
      </Tooltip>
    </li>
  );
};
