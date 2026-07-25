import { describe, it, expect } from 'vitest';
import { parseGridTemplate, serializeGridTemplate, makeFrTracks, } from '@lib/gridTemplate';
describe('parseGridTemplate', () => {
    it('parses a simple fr list', () => {
        expect(parseGridTemplate('1fr 1fr 1fr')).toEqual([
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
        ]);
    });
    it('parses mixed px / fr / % / auto / content tracks', () => {
        expect(parseGridTemplate('200px 1fr 25% auto min-content max-content')).toEqual([
            { kind: 'px', value: 200 },
            { kind: 'fr', value: 1 },
            { kind: 'percent', value: 25 },
            { kind: 'auto' },
            { kind: 'min-content' },
            { kind: 'max-content' },
        ]);
    });
    it('parses fractional fr values', () => {
        expect(parseGridTemplate('0.5fr 1.5fr')).toEqual([
            { kind: 'fr', value: 0.5 },
            { kind: 'fr', value: 1.5 },
        ]);
    });
    it('keeps minmax() / var() / calc() as raw tracks (still editable around them)', () => {
        expect(parseGridTemplate('minmax(100px, 1fr) var(--side) calc(50% - 10px)')).toEqual([
            { kind: 'raw', source: 'minmax(100px, 1fr)' },
            { kind: 'raw', source: 'var(--side)' },
            { kind: 'raw', source: 'calc(50% - 10px)' },
        ]);
    });
    it('expands a whole-string repeat(N, simple list)', () => {
        expect(parseGridTemplate('repeat(3, 1fr)')).toEqual([
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
        ]);
        expect(parseGridTemplate('repeat(2, 100px 1fr)')).toEqual([
            { kind: 'px', value: 100 },
            { kind: 'fr', value: 1 },
            { kind: 'px', value: 100 },
            { kind: 'fr', value: 1 },
        ]);
    });
    it('returns an empty list for an empty or whitespace template', () => {
        expect(parseGridTemplate('')).toEqual([]);
        expect(parseGridTemplate('   ')).toEqual([]);
    });
    it('returns null for named grid lines', () => {
        expect(parseGridTemplate('[full-start] 1fr [full-end]')).toBeNull();
    });
    it('returns null for subgrid / masonry', () => {
        expect(parseGridTemplate('subgrid')).toBeNull();
        expect(parseGridTemplate('masonry')).toBeNull();
    });
    it('returns null for auto-fill / auto-fit repeat (no fixed track count)', () => {
        expect(parseGridTemplate('repeat(auto-fill, 120px)')).toBeNull();
        expect(parseGridTemplate('repeat(auto-fit, minmax(100px, 1fr))')).toBeNull();
    });
    it('returns null for repeat() mixed with other tracks', () => {
        expect(parseGridTemplate('200px repeat(2, 1fr)')).toBeNull();
    });
});
describe('serializeGridTemplate', () => {
    it('serialises each track kind', () => {
        const tracks = [
            { kind: 'fr', value: 2 },
            { kind: 'px', value: 200 },
            { kind: 'percent', value: 25 },
            { kind: 'auto' },
            { kind: 'min-content' },
            { kind: 'max-content' },
            { kind: 'raw', source: 'minmax(100px, 1fr)' },
        ];
        expect(serializeGridTemplate(tracks)).toBe('2fr 200px 25% auto min-content max-content minmax(100px, 1fr)');
    });
    it('serialises an empty list to an empty string', () => {
        expect(serializeGridTemplate([])).toBe('');
    });
});
describe('parse → serialize → parse round-trip', () => {
    const cases = [
        '1fr 1fr 1fr',
        '200px 1fr 25% auto',
        '0.5fr 1.5fr min-content',
        'minmax(100px, 1fr) 1fr',
    ];
    for (const input of cases) {
        it(`is stable for "${input}"`, () => {
            const first = parseGridTemplate(input);
            expect(first).not.toBeNull();
            const serialized = serializeGridTemplate(first ?? []);
            expect(parseGridTemplate(serialized)).toEqual(first);
        });
    }
});
describe('makeFrTracks', () => {
    it('builds N equal fractional tracks', () => {
        expect(makeFrTracks(3)).toEqual([
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
            { kind: 'fr', value: 1 },
        ]);
        expect(serializeGridTemplate(makeFrTracks(2))).toBe('1fr 1fr');
    });
    it('clamps a non-positive count to an empty list', () => {
        expect(makeFrTracks(0)).toEqual([]);
        expect(makeFrTracks(-2)).toEqual([]);
    });
});
