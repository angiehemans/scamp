// Renderer-side snapshot list + actions. All file I/O is main-side; this
// slice just mirrors the snapshot index and drives create / restore /
// delete through IPC. The history PANEL reads from here; Cmd+Z undo is
// unaffected (it stays in historySlice). See docs/notes/snapshots.md.
import { create } from 'zustand';

import { parseCode } from '@lib/parseCode';
import type {
  SnapshotMeta,
  SnapshotRestoreResult,
  SnapshotTrigger,
} from '@shared/types';

import { useCanvasStore } from './canvasSlice';
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
  /**
   * Enter a read-only preview of `snapshot` on the canvas: read the active
   * page's files from the snapshot, parse them, and swap them onto the
   * canvas via `enterSnapshotPreview`. No-op if no page is active or the
   * snapshot doesn't contain the active page (e.g. added later).
   */
  previewSnapshot: (projectPath: string, snapshot: SnapshotMeta) => Promise<void>;
  /**
   * Commit the snapshot currently being previewed — runs the real restore
   * (whole project) and clears the preview. Errors leave the preview up so
   * the user can retry or Exit.
   */
  restorePreview: () => Promise<SnapshotRestoreResult>;
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

  previewSnapshot: async (projectPath, snapshot): Promise<void> => {
    const canvas = useCanvasStore.getState();
    const page = canvas.activePage;
    if (page === null) return;

    const res = await window.scamp.readSnapshotPage({
      projectPath,
      snapshotId: snapshot.id,
      tsxPath: page.tsxPath,
      cssPath: page.cssPath,
    });
    if (res.tsx === null || res.css === null) return;

    let parsed: ReturnType<typeof parseCode>;
    try {
      parsed = parseCode(res.tsx, res.css, { breakpoints: canvas.breakpoints });
    } catch {
      // A snapshot with unparseable content can't be previewed; the user
      // can still restore it from disk if they really want it.
      return;
    }

    useCanvasStore.getState().enterSnapshotPreview(
      {
        id: snapshot.id,
        label: snapshot.label,
        timestamp: snapshot.timestamp,
        projectPath,
      },
      {
        elements: parsed.elements,
        source: { tsx: res.tsx, css: res.css },
        customMediaBlocks: parsed.customMediaBlocks,
        keyframesBlocks: parsed.keyframesBlocks,
        cssDuplicates: parsed.cssDuplicates,
      }
    );
  },

  restorePreview: async (): Promise<SnapshotRestoreResult> => {
    const preview = useCanvasStore.getState().snapshotPreview;
    if (preview === null) {
      return { ok: false, error: 'No snapshot is being previewed.' };
    }
    const result = await get().restoreSnapshot(preview.projectPath, preview.id);
    if (result.ok) {
      // The restore re-reads the project from disk, replacing the canvas
      // content — so drop the preview without restoring the stash.
      useCanvasStore.getState().clearSnapshotPreview();
    }
    return result;
  },
}));
