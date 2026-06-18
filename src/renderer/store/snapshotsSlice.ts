// Renderer-side snapshot list + actions. All file I/O is main-side; this
// slice just mirrors the snapshot index and drives create / restore /
// delete through IPC. The history PANEL reads from here; Cmd+Z undo is
// unaffected (it stays in historySlice). See docs/notes/snapshots.md.
import { create } from 'zustand';

import type {
  SnapshotMeta,
  SnapshotRestoreResult,
  SnapshotTrigger,
} from '@shared/types';

import { useHistoryStore } from './historySlice';

type SnapshotsState = {
  snapshots: SnapshotMeta[];
  /** Re-read the snapshot index from disk (via main). */
  loadSnapshots: (projectPath: string) => Promise<void>;
  /** Create a snapshot then refresh the list. */
  takeSnapshot: (
    projectPath: string,
    trigger: SnapshotTrigger,
    label?: string
  ) => Promise<void>;
  /**
   * Restore a snapshot. On success the in-session undo stack is cleared
   * (you can't Cmd+Z back through a restore) and the list refreshes (a
   * `before_restore` snapshot was added). Main broadcasts
   * ProjectPagesChanged so the canvas/project re-reads from disk.
   */
  restoreSnapshot: (
    projectPath: string,
    snapshotId: string
  ) => Promise<SnapshotRestoreResult>;
  deleteSnapshot: (projectPath: string, snapshotId: string) => Promise<void>;
};

export const useSnapshotsStore = create<SnapshotsState>((set, get) => ({
  snapshots: [],

  loadSnapshots: async (projectPath): Promise<void> => {
    const { snapshots } = await window.scamp.listSnapshots({ projectPath });
    set({ snapshots });
  },

  takeSnapshot: async (projectPath, trigger, label): Promise<void> => {
    await window.scamp.createSnapshot({ projectPath, trigger, label });
    await get().loadSnapshots(projectPath);
  },

  restoreSnapshot: async (projectPath, snapshotId): Promise<SnapshotRestoreResult> => {
    const result = await window.scamp.restoreSnapshot({ projectPath, snapshotId });
    if (result.ok) {
      // A restore is a hard reset — the in-session undo stack no longer
      // lines up with the canvas, so clear it.
      useHistoryStore.getState().clearAllHistory();
      await get().loadSnapshots(projectPath);
    }
    return result;
  },

  deleteSnapshot: async (projectPath, snapshotId): Promise<void> => {
    await window.scamp.deleteSnapshot({ projectPath, snapshotId });
    await get().loadSnapshots(projectPath);
  },
}));
