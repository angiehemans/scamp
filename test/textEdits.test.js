import { describe, it, expect } from 'vitest';
import { applyEdits, diffText, editStats } from '@lib/textEdits';
/**
 * The edit representation a save will write instead of a whole file.
 * see docs/plans/incremental-writes-plan.md
 */
/** Every diff must reproduce the target, whatever else it does. */
const roundTrips = (base, next) => {
    const edits = diffText(base, next);
    expect(applyEdits(base, edits)).toBe(next);
    return edits;
};
describe('diffText', () => {
    it('produces nothing for identical text', () => {
        expect(diffText('a\nb\n', 'a\nb\n')).toEqual([]);
        expect(diffText('', '')).toEqual([]);
    });
    it('addresses one changed line and leaves the rest alone', () => {
        const base = 'one\ntwo\nthree\n';
        const edits = roundTrips(base, 'one\nTWO\nthree\n');
        expect(edits).toEqual([{ start: 4, end: 8, replacement: 'TWO\n' }]);
        expect(base.slice(4, 8)).toBe('two\n');
    });
    it('separates two changed lines into two hunks', () => {
        const base = 'a\nb\nc\nd\ne\n';
        const edits = roundTrips(base, 'A\nb\nc\nd\nE\n');
        expect(edits).toHaveLength(2);
        expect(edits[0]).toEqual({ start: 0, end: 2, replacement: 'A\n' });
        expect(edits[1]).toEqual({ start: 8, end: 10, replacement: 'E\n' });
    });
    it('inserts without covering any existing line', () => {
        const base = 'a\nc\n';
        const edits = roundTrips(base, 'a\nb\nc\n');
        expect(edits).toEqual([{ start: 2, end: 2, replacement: 'b\n' }]);
    });
    it('deletes with an empty replacement', () => {
        const edits = roundTrips('a\nb\nc\n', 'a\nc\n');
        expect(edits).toEqual([{ start: 2, end: 4, replacement: '' }]);
    });
    it('handles a change at the very start and at the very end', () => {
        expect(roundTrips('a\nb\n', 'z\nb\n')[0]).toEqual({ start: 0, end: 2, replacement: 'z\n' });
        const appended = roundTrips('a\nb\n', 'a\nb\nc\n');
        expect(appended).toEqual([{ start: 4, end: 4, replacement: 'c\n' }]);
    });
    it('handles empty sides and a missing trailing newline', () => {
        expect(roundTrips('', 'a\n')).toEqual([{ start: 0, end: 0, replacement: 'a\n' }]);
        expect(roundTrips('a\n', '')).toEqual([{ start: 0, end: 2, replacement: '' }]);
        roundTrips('a\nb', 'a\nB');
        roundTrips('a\nb\n', 'a\nb');
    });
    it('sees an indentation change as a changed line, not a rewrite', () => {
        const base = '<div>\n  <p>hi</p>\n</div>\n';
        const edits = roundTrips(base, '<div>\n    <p>hi</p>\n</div>\n');
        expect(edits).toHaveLength(1);
        expect(edits[0]?.replacement).toBe('    <p>hi</p>\n');
    });
    it('keeps a repeated line from dragging the whole block into one hunk', () => {
        // Three identical lines, one of them changed: the matcher should
        // reuse the other two rather than replacing the run.
        const base = 'x\nx\nx\n';
        const edits = roundTrips(base, 'x\ny\nx\n');
        expect(edits).toHaveLength(1);
        expect(editStats(base, edits).linesRemoved).toBe(1);
    });
    it('emits hunks in ascending, non-overlapping order', () => {
        const base = Array.from({ length: 40 }, (_, i) => `line ${i}\n`).join('');
        const next = base.replace('line 5\n', 'LINE 5\n').replace('line 30\n', 'LINE 30\n');
        const edits = roundTrips(base, next);
        expect(edits).toHaveLength(2);
        for (let i = 1; i < edits.length; i += 1) {
            expect(edits[i]?.start).toBeGreaterThanOrEqual(edits[i - 1]?.end ?? 0);
        }
    });
});
describe('applyEdits', () => {
    it('applies an insert, a replace, and a delete together', () => {
        const base = 'a\nb\nc\n';
        expect(applyEdits(base, [
            { start: 0, end: 0, replacement: 'z\n' },
            { start: 2, end: 4, replacement: 'B\n' },
            { start: 4, end: 6, replacement: '' },
        ])).toBe('z\na\nB\n');
    });
    it('is the identity for no edits', () => {
        expect(applyEdits('a\nb\n', [])).toBe('a\nb\n');
    });
    it('refuses overlapping, unsorted, or out-of-range edits', () => {
        const base = 'a\nb\nc\n';
        expect(() => applyEdits(base, [
            { start: 0, end: 4, replacement: 'x' },
            { start: 2, end: 6, replacement: 'y' },
        ])).toThrow('overlap');
        expect(() => applyEdits(base, [
            { start: 4, end: 6, replacement: 'x' },
            { start: 0, end: 2, replacement: 'y' },
        ])).toThrow('overlap');
        expect(() => applyEdits(base, [{ start: 0, end: 99, replacement: '' }])).toThrow('outside');
        expect(() => applyEdits(base, [{ start: 3, end: 1, replacement: '' }])).toThrow('outside');
    });
});
describe('editStats', () => {
    it('counts hunks and the lines each side of the change', () => {
        const base = 'a\nb\nc\n';
        expect(editStats(base, diffText(base, 'a\nB\nc\n'))).toEqual({
            hunks: 1,
            linesRemoved: 1,
            linesAdded: 1,
            baseLines: 3,
        });
        expect(editStats(base, diffText(base, 'a\nb\nc\nd\ne\n'))).toEqual({
            hunks: 1,
            linesRemoved: 0,
            linesAdded: 2,
            baseLines: 3,
        });
    });
    it('reports nothing changed for an unchanged file', () => {
        expect(editStats('a\n', [])).toEqual({
            hunks: 0,
            linesRemoved: 0,
            linesAdded: 0,
            baseLines: 1,
        });
    });
});
