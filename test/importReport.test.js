import { describe, it, expect } from 'vitest';
import { buildReport } from '@lib/importReport';
/**
 * The import report.
 *
 * An import is a lossy translation, and the difference between a tool
 * you trust and one you don't is whether it tells you where it lied.
 * These cases are mostly about readability under load — the report has
 * to stay useful on a page that produced three hundred findings, which
 * is exactly when someone needs it.
 * see docs/plans/website-import-plan.md
 */
const finding = (kind, at) => ({ kind, ...(at === undefined ? {} : { at }) });
describe('buildReport', () => {
    it('groups repeats into one line with a count', () => {
        const report = buildReport([
            finding('pseudo-element', 'a::before'),
            finding('pseudo-element', 'b::before'),
            finding('pseudo-element', 'c::after'),
        ]);
        expect(report).toHaveLength(1);
        expect(report[0]?.count).toBe(3);
        expect(report[0]?.label).toContain('3 decorative');
    });
    it('pluralises for one', () => {
        const report = buildReport([finding('canvas', 'canvas')]);
        expect(report[0]?.label).toContain('1 <canvas> element');
        expect(report[0]?.label).not.toContain('elements');
    });
    it('puts losses before translations, whatever their counts', () => {
        // 200 collapsed wrappers are bookkeeping; one dropped icon is not,
        // and burying it under them is how a report stops being read.
        const report = buildReport([
            ...Array.from({ length: 200 }, (_, i) => finding('collapsed-wrapper', `div${i}`)),
            finding('pseudo-element', 'a::before'),
        ]);
        expect(report[0]?.kind).toBe('pseudo-element');
        expect(report[0]?.lost).toBe(true);
        expect(report[1]?.lost).toBe(false);
    });
    it('orders within a group by how much of the page it touched', () => {
        const report = buildReport([
            finding('collapsed-wrapper', 'a'),
            ...Array.from({ length: 5 }, (_, i) => finding('block-to-flex', `b${i}`)),
        ]);
        expect(report.map((g) => g.kind)).toEqual(['block-to-flex', 'collapsed-wrapper']);
    });
    it('keeps a few locations, not all of them', () => {
        const report = buildReport(Array.from({ length: 50 }, (_, i) => finding('pseudo-element', `el${i}::before`)));
        expect(report[0]?.count).toBe(50);
        expect(report[0]?.examples.length).toBeLessThanOrEqual(4);
        expect(report[0]?.examples[0]).toBe('el0::before');
    });
    it('does not repeat the same location twice', () => {
        const report = buildReport([
            finding('pseudo-element', 'nav::before'),
            finding('pseudo-element', 'nav::before'),
        ]);
        expect(report[0]?.examples).toEqual(['nav::before']);
    });
    it('marks a translation as not lost, so it is not read as damage', () => {
        // Turning a block container into a flex column changes the file and
        // changes nothing you can see.
        const report = buildReport([finding('block-to-flex', 'div')]);
        expect(report[0]?.lost).toBe(false);
    });
    it.each([
        ['pseudo-element', true],
        ['canvas', true],
        ['iframe', true],
        ['shadow-root', true],
        ['unsupported-display', true],
        ['marker-leaked', true],
        ['svg', false],
        ['inline-kept', false],
        ['collapsed-wrapper', false],
        ['dropped-computed-size', false],
        ['revealed-on-scroll', false],
    ])('classifies %s as lost=%s', (kind, lost) => {
        expect(buildReport([finding(kind, 'x')])[0]?.lost).toBe(lost);
    });
    it('still reports a kind nobody wrote a description for', () => {
        // A finding no one described is still a finding; dropping it would
        // make the report quietly wrong.
        const report = buildReport([finding('some-new-kind', 'x'), finding('some-new-kind', 'y')]);
        expect(report[0]?.label).toBe('2 x some new kind');
        expect(report[0]?.lost).toBe(true);
    });
    it('counts a finding that stands for more than one element', () => {
        // The breakpoint passes raise one finding per breakpoint, not per
        // element. Counting findings said "1 element is missing at a
        // narrower width" whether it was one element or forty.
        const report = buildReport([
            { kind: 'breakpoint-absent', at: 'tablet', count: 12 },
            { kind: 'breakpoint-absent', at: 'mobile', count: 28 },
        ]);
        expect(report[0]?.count).toBe(40);
        expect(report[0]?.label).toContain('40 elements are');
    });
    it('still names the breakpoints rather than the elements', () => {
        const report = buildReport([
            { kind: 'breakpoint-captured', at: 'tablet', count: 9 },
        ]);
        expect(report[0]?.examples).toEqual(['tablet']);
    });
    it('treats a finding with no count as standing for one thing', () => {
        expect(buildReport([finding('pseudo-element', 'a::before')])[0]?.count).toBe(1);
    });
    it('returns nothing for a clean import', () => {
        expect(buildReport([])).toEqual([]);
    });
    it('survives findings that carry no location', () => {
        const report = buildReport([finding('node-capped')]);
        expect(report[0]?.examples).toEqual([]);
        expect(report[0]?.label).toContain('larger than one import');
    });
});
