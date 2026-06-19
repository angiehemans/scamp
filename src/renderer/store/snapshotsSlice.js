// Renderer-side snapshot list + actions. All file I/O is main-side; this
// slice just mirrors the snapshot index and drives create / restore /
// delete through IPC. The history PANEL reads from here; Cmd+Z undo is
// unaffected (it stays in historySlice). See docs/notes/snapshots.md.
import { create } from 'zustand';
import { parseCode } from '@lib/parseCode';
import { useCanvasStore } from './canvasSlice';
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
    previewSnapshot: async (projectPath, snapshot) => {
        const canvas = useCanvasStore.getState();
        const page = canvas.activePage;
        if (page === null)
            return;
        const res = await window.scamp.readSnapshotPage({
            projectPath,
            snapshotId: snapshot.id,
            tsxPath: page.tsxPath,
            cssPath: page.cssPath,
        });
        if (res.tsx === null || res.css === null)
            return;
        let parsed;
        try {
            parsed = parseCode(res.tsx, res.css, { breakpoints: canvas.breakpoints });
        }
        catch {
            // A snapshot with unparseable content can't be previewed; the user
            // can still restore it from disk if they really want it.
            return;
        }
        useCanvasStore.getState().enterSnapshotPreview({
            id: snapshot.id,
            label: snapshot.label,
            timestamp: snapshot.timestamp,
            projectPath,
        }, {
            elements: parsed.elements,
            source: { tsx: res.tsx, css: res.css },
            customMediaBlocks: parsed.customMediaBlocks,
            keyframesBlocks: parsed.keyframesBlocks,
            cssDuplicates: parsed.cssDuplicates,
        });
    },
    restorePreview: async () => {
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
