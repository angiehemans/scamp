import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSnapshotsStore } from '../src/renderer/store/snapshotsSlice';
import { useHistoryStore } from '../src/renderer/store/historySlice';
const meta = (over) => ({
    id: 'snap_x',
    timestamp: '2026-05-01T10:00:00.000Z',
    trigger: 'manual',
    label: 'x',
    pageCount: 1,
    ...over,
});
describe('snapshotsSlice', () => {
    beforeEach(() => {
        useSnapshotsStore.setState({ snapshots: [] });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    it('loadSnapshots mirrors the main-side list', async () => {
        const list = [meta({ id: 'a' }), meta({ id: 'b' })];
        vi.stubGlobal('window', {
            scamp: { listSnapshots: vi.fn().mockResolvedValue({ snapshots: list }) },
        });
        await useSnapshotsStore.getState().loadSnapshots('/proj');
        expect(useSnapshotsStore.getState().snapshots).toEqual(list);
    });
    it('takeSnapshot creates then refreshes the list', async () => {
        const createSnapshot = vi.fn().mockResolvedValue({ snapshot: meta({ id: 'a' }) });
        const listSnapshots = vi
            .fn()
            .mockResolvedValue({ snapshots: [meta({ id: 'a' })] });
        vi.stubGlobal('window', { scamp: { createSnapshot, listSnapshots } });
        await useSnapshotsStore.getState().takeSnapshot('/proj', 'manual', 'my name');
        expect(createSnapshot).toHaveBeenCalledWith({
            projectPath: '/proj',
            trigger: 'manual',
            label: 'my name',
        });
        expect(useSnapshotsStore.getState().snapshots).toHaveLength(1);
    });
    it('restoreSnapshot clears the undo stack + reloads on success', async () => {
        const clearAllHistory = vi.fn();
        useHistoryStore.setState({ clearAllHistory });
        vi.stubGlobal('window', {
            scamp: {
                restoreSnapshot: vi
                    .fn()
                    .mockResolvedValue({ ok: true, snapshotId: 'a' }),
                listSnapshots: vi.fn().mockResolvedValue({ snapshots: [] }),
            },
        });
        const res = await useSnapshotsStore.getState().restoreSnapshot('/proj', 'a');
        expect(res).toEqual({ ok: true, snapshotId: 'a' });
        expect(clearAllHistory).toHaveBeenCalledOnce();
    });
    it('restoreSnapshot leaves the undo stack alone on failure', async () => {
        const clearAllHistory = vi.fn();
        useHistoryStore.setState({ clearAllHistory });
        vi.stubGlobal('window', {
            scamp: {
                restoreSnapshot: vi
                    .fn()
                    .mockResolvedValue({ ok: false, error: 'boom' }),
            },
        });
        const res = await useSnapshotsStore.getState().restoreSnapshot('/proj', 'a');
        expect(res).toEqual({ ok: false, error: 'boom' });
        expect(clearAllHistory).not.toHaveBeenCalled();
    });
});
