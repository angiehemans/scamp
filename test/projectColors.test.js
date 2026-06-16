import { describe, it, expect } from 'vitest';
import { projectColorsFromElements } from '@lib/projectColors';
const el = (backgroundColor, borderColor = '#000000', color) => ({ backgroundColor, borderColor, color });
describe('projectColorsFromElements', () => {
    it('returns [] when there are no meaningful colors', () => {
        expect(projectColorsFromElements({})).toEqual([]);
    });
    it('excludes keyword/non-colors (transparent, inherit, currentColor, …)', () => {
        const elements = {
            a: el('transparent', 'inherit'),
            b: el('unset', 'initial'),
        };
        expect(projectColorsFromElements(elements)).toEqual([]);
    });
    it('dedupes and sorts by frequency (most used first)', () => {
        const elements = {
            a: el('#ff0000', '#00ff00'),
            b: el('#ff0000', '#ff0000'),
            c: el('#0000ff', '#ff0000'),
        };
        // #ff0000 appears 4×, #00ff00 1×, #0000ff 1× → #ff0000 leads.
        expect(projectColorsFromElements(elements)[0]).toBe('#ff0000');
        expect(projectColorsFromElements(elements)).toContain('#00ff00');
        expect(projectColorsFromElements(elements)).toContain('#0000ff');
    });
    it('skips empty / non-string color fields', () => {
        const elements = { a: el('', '#123456') };
        expect(projectColorsFromElements(elements)).toEqual(['#123456']);
    });
});
