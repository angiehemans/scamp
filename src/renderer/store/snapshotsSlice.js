// Renderer-side snapshot list + actions. All file I/O is main-side; this
// slice just mirrors the snapshot index and drives create / restore /
// delete through IPC. The history PANEL reads from here; Cmd+Z undo is
// unaffected (it stays in historySlice). See docs/notes/snapshots.md.
import { create } from 'zustand';
import { useHistoryStore } from './historySlice';
export const useSnapshotsStore = create((set, get) => ({
    snapshots: [],
    loadSnapshots: async (projectPath) => {
        const { snapshots } = await window.scamp.listSnapshots({ projectPath });
        set({ snapshots });
    },
    takeSnapshot: async (projectPath, trigger, label) => {
        await window.scamp.createSnapshot({ projectPath, trigger, label });
        await get().loadSnapshots(projectPath);
    },
    restoreSnapshot: async (projectPath, snapshotId) => {
        const result = await window.scamp.restoreSnapshot({ projectPath, snapshotId });
        if (result.ok) {
            // A restore is a hard reset — the in-session undo stack no longer
            // lines up with the canvas, so clear it.
            useHistoryStore.getState().clearAllHistory();
            await get().loadSnapshots(projectPath);
        }
        return result;
    },
    deleteSnapshot: async (projectPath, snapshotId) => {
        await window.scamp.deleteSnapshot({ projectPath, snapshotId });
        await get().loadSnapshots(projectPath);
    },
}));
