import { describe, it, expect } from 'vitest';
import { mergeText } from '@lib/threeWayMerge';
/**
 * see docs/plans/incremental-writes-plan.md, phase 4
 */
const BASE = `.root {
    display: flex;
}

.title {
    color: #111111;
}

.box {
    width: 100px;
}
`;
const expectOk = (result) => {
    if (!result.ok)
        throw new Error(`expected a merge, got ${result.overlaps.length} overlaps`);
    return result.text;
};
describe('mergeText', () => {
    it('returns the text unchanged when neither side changed anything', () => {
        expect(expectOk(mergeText(BASE, BASE, BASE))).toBe(BASE);
    });
    it('takes our change when disk did not move', () => {
        const ours = BASE.replace('#111111', '#222222');
        expect(expectOk(mergeText(BASE, ours, BASE))).toBe(ours);
    });
    it('takes their change when we did not move', () => {
        const theirs = BASE.replace('#111111', '#222222');
        expect(expectOk(mergeText(BASE, BASE, theirs))).toBe(theirs);
    });
    it('keeps both when the two sides changed different regions', () => {
        const ours = BASE.replace('width: 100px;', 'width: 240px;');
        const theirs = BASE.replace('color: #111111;', 'color: #222222;');
        const merged = expectOk(mergeText(BASE, ours, theirs));
        expect(merged).toContain('width: 240px;');
        expect(merged).toContain('color: #222222;');
    });
    it('keeps both when one side appends and the other edits', () => {
        const ours = BASE.replace('width: 100px;', 'width: 240px;');
        const theirs = `${BASE}\n.added {\n    color: red;\n}\n`;
        const merged = expectOk(mergeText(BASE, ours, theirs));
        expect(merged).toContain('width: 240px;');
        expect(merged).toContain('.added');
    });
    it('keeps both when one side deletes a rule the other did not touch', () => {
        const ours = BASE.replace('.box {\n    width: 100px;\n}\n', '');
        const theirs = BASE.replace('color: #111111;', 'color: #222222;');
        const merged = expectOk(mergeText(BASE, ours, theirs));
        expect(merged).not.toContain('.box');
        expect(merged).toContain('color: #222222;');
    });
    it('counts one edit once when both sides made it', () => {
        const same = BASE.replace('#111111', '#222222');
        const result = mergeText(BASE, same, same);
        expect(result).toEqual({ ok: true, text: same, fromOurs: 0, fromTheirs: 0 });
    });
    it('merges when both sides made the same change and one made another', () => {
        const shared = BASE.replace('#111111', '#222222');
        const ours = shared.replace('width: 100px;', 'width: 240px;');
        const merged = expectOk(mergeText(BASE, ours, shared));
        expect(merged).toBe(ours);
    });
    it('refuses when both sides rewrote the same line', () => {
        const ours = BASE.replace('#111111', '#222222');
        const theirs = BASE.replace('#111111', '#333333');
        const result = mergeText(BASE, ours, theirs);
        expect(result.ok).toBe(false);
    });
    it('refuses when one side edits a line the other deleted', () => {
        const ours = BASE.replace('.title {\n    color: #111111;\n}\n\n', '');
        const theirs = BASE.replace('color: #111111;', 'color: #333333;');
        expect(mergeText(BASE, ours, theirs).ok).toBe(false);
    });
    it('reports the base region the two sides disagree about', () => {
        const ours = BASE.replace('#111111', '#222222');
        const theirs = BASE.replace('#111111', '#333333');
        const result = mergeText(BASE, ours, theirs);
        if (result.ok)
            throw new Error('expected a conflict');
        expect(result.overlaps).toHaveLength(1);
        const { start, end } = result.overlaps[0] ?? { start: 0, end: 0 };
        expect(BASE.slice(start, end)).toContain('color: #111111;');
    });
    it('refuses when both sides insert different text at the same point', () => {
        const ours = BASE.replace('.box {', '.inserted-a {}\n\n.box {');
        const theirs = BASE.replace('.box {', '.inserted-b {}\n\n.box {');
        expect(mergeText(BASE, ours, theirs).ok).toBe(false);
    });
    it('merges edits on adjacent lines', () => {
        const ours = BASE.replace('.title {\n    color', '.title {\n    font-weight: 700;\n    color');
        const theirs = BASE.replace('.root {\n    display: flex;\n}', '.root {\n    display: grid;\n}');
        const merged = expectOk(mergeText(BASE, ours, theirs));
        expect(merged).toContain('font-weight: 700;');
        expect(merged).toContain('display: grid;');
    });
    it('merges into an empty base', () => {
        expect(expectOk(mergeText('', '', 'a\n'))).toBe('a\n');
    });
    it('keeps a change made where the other side stripped the trailing newline', () => {
        const ours = BASE.replace('width: 100px;', 'width: 240px;');
        const theirs = BASE.trimEnd();
        const merged = expectOk(mergeText(BASE, ours, theirs));
        expect(merged).toContain('width: 240px;');
        expect(merged.endsWith('}')).toBe(true);
    });
});
