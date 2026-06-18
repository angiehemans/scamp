import { useEffect } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useSnapshotsStore } from '@store/snapshotsSlice';
import { flushPendingPageWrite } from '../../syncBridge';
/** Take at most one auto-save snapshot per this much canvas activity. */
const AUTO_SAVE_INTERVAL_MS = 5 * 60_000;
/**
 * The "significant canvas change" snapshot trigger: while editing, take an
 * `auto_save` snapshot at most once every 5 minutes of canvas activity, so
 * the user has in-session restore points without one per action. Idle time
 * contributes nothing (the check only runs on a real element change).
 * Disabled when `enabled` is false (the project's `snapshotAutoSave`
 * config flag). Flushes the pending write first so the snapshot includes
 * the latest canvas state. See docs/notes/snapshots.md.
 */
export const useSnapshotAutoSave = (projectPath, enabled) => {
    useEffect(() => {
        if (!enabled)
            return;
        let lastAutoMs = Date.now();
        const unsub = useCanvasStore.subscribe((state, prev) => {
            // Only genuine element edits count as activity.
            if (state.elements === prev.elements)
                return;
            const nowMs = Date.now();
            if (nowMs - lastAutoMs < AUTO_SAVE_INTERVAL_MS)
                return;
            lastAutoMs = nowMs;
            flushPendingPageWrite();
            void useSnapshotsStore.getState().takeSnapshot(projectPath, 'auto_save');
        });
        return unsub;
    }, [projectPath, enabled]);
};
