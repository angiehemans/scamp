import { ipcMain } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  SnapshotCreateArgs,
  SnapshotCreateResult,
  SnapshotDeleteArgs,
  SnapshotDeleteResult,
  SnapshotListArgs,
  SnapshotListResult,
  SnapshotRestoreArgs,
  SnapshotRestoreResult,
} from '@shared/types';

import { getProjectFormat } from './projectFormatCache';
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  restoreSnapshot,
} from './snapshotOps';

/**
 * Wire up the project-snapshot IPC channels. Every handler resolves the
 * project format from the cached lookup before delegating, mirroring the
 * page / component handlers. All `.scamp/` file I/O lives in snapshotOps.
 *
 * The restore's main → renderer `SnapshotRestoreComplete` broadcast is
 * added in Phase E alongside the reload orchestration; for now restore is
 * a plain invoke that returns once the files are copied back.
 */
export const registerSnapshotIpc = (): void => {
  ipcMain.handle(
    IPC.SnapshotCreate,
    async (_e, args: SnapshotCreateArgs): Promise<SnapshotCreateResult> => {
      const format = await getProjectFormat(args.projectPath);
      const snapshot = await createSnapshot(
        args.projectPath,
        format,
        args.trigger,
        args.label
      );
      return { snapshot };
    }
  );

  ipcMain.handle(
    IPC.SnapshotList,
    async (_e, args: SnapshotListArgs): Promise<SnapshotListResult> => {
      return { snapshots: await listSnapshots(args.projectPath) };
    }
  );

  ipcMain.handle(
    IPC.SnapshotRestore,
    async (_e, args: SnapshotRestoreArgs): Promise<SnapshotRestoreResult> => {
      const format = await getProjectFormat(args.projectPath);
      const result = await restoreSnapshot(
        args.projectPath,
        format,
        args.snapshotId
      );
      if (result.ok) return { ok: true, snapshotId: args.snapshotId };
      return { ok: false, error: result.error ?? 'Restore failed.' };
    }
  );

  ipcMain.handle(
    IPC.SnapshotDelete,
    async (_e, args: SnapshotDeleteArgs): Promise<SnapshotDeleteResult> => {
      return deleteSnapshot(args.projectPath, args.snapshotId);
    }
  );
};
