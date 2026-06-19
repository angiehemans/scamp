import { describe, it, expect } from 'vitest';
import { formatPageCount, mergeHistoryTimeline, snapshotsNewestFirst, triggerIcon, } from '../src/renderer/store/snapshotDisplay';
const meta = (over) => ({
    id: 'snap_x',
    timestamp: '2026-05-01T10:00:00.000Z',
    trigger: 'manual',
    label: 'x',
    pageCount: 1,
    ...over,
});
/** Epoch ms for a UTC time on 2026-05-01, for readable fixtures. */
const at = (hhmmss) => Date.parse(`2026-05-01T${hhmmss}.000Z`);
const entry = (over) => ({
    id: 'hist_x',
    timestamp: at('10:00:00'),
    kind: 'draw-rect',
    elementIds: [],
    snapshot: {},
    ...over,
});
describe('triggerIcon', () => {
    it('maps each trigger to an icon family', () => {
        expect(triggerIcon('session_open')).toBe('session-open');
        expect(triggerIcon('session_close')).toBe('session-close');
        expect(triggerIcon('agent_edit')).toBe('agent');
        expect(triggerIcon('manual')).toBe('manual');
        expect(triggerIcon('auto_save')).toBe('auto');
        expect(triggerIcon('before_restore')).toBe('restore');
    });
});
describe('snapshotsNewestFirst', () => {
    it('reverses oldest-first storage into newest-first display', () => {
        const list = [meta({ id: 'a' }), meta({ id: 'b' }), meta({ id: 'c' })];
        expect(snapshotsNewestFirst(list).map((s) => s.id)).toEqual(['c', 'b', 'a']);
    });
    it('does not mutate the input', () => {
        const list = [meta({ id: 'a' }), meta({ id: 'b' })];
        snapshotsNewestFirst(list);
        expect(list.map((s) => s.id)).toEqual(['a', 'b']);
    });
});
describe('formatPageCount', () => {
    it('pluralises', () => {
        expect(formatPageCount(1)).toBe('1 page');
        expect(formatPageCount(2)).toBe('2 pages');
        expect(formatPageCount(0)).toBe('0 pages');
    });
});
describe('mergeHistoryTimeline', () => {
    it('interleaves snapshots and undo entries newest-first by timestamp', () => {
        const snapshots = [
            meta({ id: 'snap_open', timestamp: '2026-05-01T10:00:00.000Z' }),
            meta({ id: 'snap_auto', timestamp: '2026-05-01T10:02:00.000Z' }),
        ];
        const entries = [
            entry({ id: 'h_draw1', timestamp: at('10:01:00') }),
            entry({ id: 'h_draw2', timestamp: at('10:03:00') }),
        ];
        const result = mergeHistoryTimeline(snapshots, entries, 1);
        expect(result.map((i) => (i.kind === 'snapshot' ? i.snapshot.id : i.entry.id))).toEqual(['h_draw2', 'snap_auto', 'h_draw1', 'snap_open']);
    });
    it("omits the synthetic 'load' baseline entry", () => {
        const entries = [
            entry({ id: 'h_load', kind: 'load', timestamp: at('10:00:00') }),
            entry({ id: 'h_draw', kind: 'draw-rect', timestamp: at('10:01:00') }),
        ];
        const result = mergeHistoryTimeline([], entries, 1);
        expect(result).toHaveLength(1);
        expect(result[0]?.kind === 'undo' && result[0].entry.id).toBe('h_draw');
    });
    it('marks the cursor entry current and later entries future', () => {
        const entries = [
            entry({ id: 'h_a', timestamp: at('10:00:00') }),
            entry({ id: 'h_b', timestamp: at('10:01:00') }),
            entry({ id: 'h_c', timestamp: at('10:02:00') }),
        ];
        const flags = mergeHistoryTimeline([], entries, 1)
            .filter((i) => i.kind === 'undo')
            .map((i) => ({ id: i.entry.id, isCurrent: i.isCurrent, isFuture: i.isFuture }));
        // Newest-first: c (future), b (current), a (past).
        expect(flags).toEqual([
            { id: 'h_c', isCurrent: false, isFuture: true },
            { id: 'h_b', isCurrent: true, isFuture: false },
            { id: 'h_a', isCurrent: false, isFuture: false },
        ]);
    });
    it('keeps the undo index pointing at the original stack position', () => {
        const entries = [
            entry({ id: 'h_load', kind: 'load', timestamp: at('10:00:00') }),
            entry({ id: 'h_a', timestamp: at('10:01:00') }),
            entry({ id: 'h_b', timestamp: at('10:02:00') }),
        ];
        const byId = new Map(mergeHistoryTimeline([], entries, 2)
            .filter((i) => i.kind === 'undo')
            .map((i) => [i.entry.id, i.index]));
        // Indices reflect position in the raw entries array, load included.
        expect(byId.get('h_a')).toBe(1);
        expect(byId.get('h_b')).toBe(2);
    });
    it('shows a snapshot above an undo entry sharing the same timestamp', () => {
        const snapshots = [meta({ id: 'snap', timestamp: '2026-05-01T10:00:00.000Z' })];
        const entries = [entry({ id: 'h_a', timestamp: at('10:00:00') })];
        const result = mergeHistoryTimeline(snapshots, entries, 0);
        expect(result.map((i) => i.kind)).toEqual(['snapshot', 'undo']);
    });
    it('returns an empty timeline when there is nothing to show', () => {
        expect(mergeHistoryTimeline([], [], -1)).toEqual([]);
    });
});
