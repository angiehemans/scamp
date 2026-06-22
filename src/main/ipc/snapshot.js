import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { getProjectFormat } from './projectFormatCache';
import { notifyPagesChanged, registerPendingWrite } from '../watcher';
import { createSnapshot, deleteSnapshot, listSnapshots, readSnapshotPage, restoreSnapshot, } from './snapshotOps';
/**
 * Wire up the project-snapshot IPC channels. Every handler resolves the
 * project format from the cached lookup before delegating, mirroring the
 * page / component handlers. All `.scamp/` file I/O lives in snapshotOps.
 *
 * Restore registers a suppressed pending-write for every file it copies
 * back, so the watcher treats the burst as Scamp's own writes (no
 * `agent_edit` snapshot, no per-file reload), then broadcasts
 * ProjectPagesChanged so the renderer re-reads the whole project from
 * disk through the existing refresh path. The renderer additionally
 * clears the in-session undo stack on a successful restore.
 */
export const registerSnapshotIpc = () => {
    ipcMain.handle(IPC.SnapshotCreate, async (_e, args) => {
        const format = await getProjectFormat(args.projectPath);
        const snapshot = await createSnapshot(args.projectPath, format, args.trigger, args.label);
        return { snapshot };
    });
    ipcMain.handle(IPC.SnapshotList, async (_e, args) => {
        return { snapshots: await listSnapshots(args.projectPath) };
    });
    ipcMain.handle(IPC.SnapshotRestore, async (_e, args) => {
        const format = await getProjectFormat(args.projectPath);
        // One writeId for the whole restore burst; suppress chokidar for
        // each copied file so the watcher doesn't mistake the restore for
        // external edits.
        const writeId = randomUUID();
        const result = await restoreSnapshot(args.projectPath, format, args.snapshotId, {
            beforeWrite: (dest) => registerPendingWrite(dest, writeId, true),
        });
        if (!result.ok) {
            return { ok: false, error: result.error ?? 'Restore failed.' };
        }
        // Drive a full project re-read in the renderer through the existing
        // pages-changed path (the per-file file:changed events were suppressed).
        notifyPagesChanged();
        return { ok: true, snapshotId: args.snapshotId };
    });
    ipcMain.handle(IPC.SnapshotDelete, async (_e, args) => {
        return deleteSnapshot(args.projectPath, args.snapshotId);
    });
    ipcMain.handle(IPC.SnapshotReadPage, async (_e, args) => readSnapshotPage(args.projectPath, args.snapshotId, args.tsxPath, args.cssPath));
};
