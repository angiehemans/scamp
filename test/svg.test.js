// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isSvgMarkup, sanitizeSvg, sanitizeSvgInner, prepareSvgForInsert, } from '../src/renderer/src/lib/svg';
describe('isSvgMarkup', () => {
    it('accepts a bare svg element', () => {
        expect(isSvgMarkup('<svg viewBox="0 0 10 10"></svg>')).toBe(true);
    });
    it('accepts a self-closing svg and leading whitespace', () => {
        expect(isSvgMarkup('   <svg/>')).toBe(true);
    });
    it('accepts an svg preceded by an xml declaration and a comment', () => {
        expect(isSvgMarkup('<?xml version="1.0"?>\n<!-- icon -->\n<svg></svg>')).toBe(true);
    });
    it('rejects non-svg text and other markup', () => {
        expect(isSvgMarkup('hello world')).toBe(false);
        expect(isSvgMarkup('<div><svg></svg></div>')).toBe(false);
        expect(isSvgMarkup('')).toBe(false);
    });
});
describe('sanitizeSvg', () => {
    it('removes a <script> element but keeps the shapes', () => {
        const out = sanitizeSvg('<svg><script>alert(1)</script><circle r="5"/></svg>');
        expect(out).not.toMatch(/<script/i);
        expect(out).toMatch(/<circle/i);
    });
    it('strips inline event-handler attributes', () => {
        const out = sanitizeSvg('<svg onload="alert(1)"><path d="M0 0"/></svg>');
        expect(out.toLowerCase()).not.toContain('onload');
        expect(out).toMatch(/<path/i);
    });
    it('drops <foreignObject> payloads', () => {
        const out = sanitizeSvg('<svg><foreignObject><iframe src="x"></iframe></foreignObject></svg>');
        expect(out.toLowerCase()).not.toContain('foreignobject');
        expect(out.toLowerCase()).not.toContain('<iframe');
    });
});
describe('sanitizeSvgInner', () => {
    it('returns sanitized inner shape markup without the svg wrapper', () => {
        const out = sanitizeSvgInner('<circle r="5"/><path d="M0 0"/>');
        expect(out).toMatch(/<circle/i);
        expect(out).toMatch(/<path/i);
        expect(out.toLowerCase()).not.toContain('<svg');
    });
    it('strips scripts from inner markup', () => {
        const out = sanitizeSvgInner('<script>alert(1)</script><circle r="5"/>');
        expect(out.toLowerCase()).not.toContain('<script');
        expect(out).toMatch(/<circle/i);
    });
    it('returns empty string for empty input', () => {
        expect(sanitizeSvgInner('   ')).toBe('');
    });
});
describe('prepareSvgForInsert', () => {
    it('returns the inner source and viewBox for a valid svg', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>');
        expect(result).not.toBeNull();
        expect(result.viewBox).toBe('0 0 24 24');
        expect(result.svgSource).toMatch(/<circle/i);
    });
    it('derives width/height from explicit attributes', () => {
        const result = prepareSvgForInsert('<svg width="48" height="32" viewBox="0 0 24 16"><rect/></svg>');
        expect(result.width).toBe(48);
        expect(result.height).toBe(32);
    });
    it('falls back to viewBox dimensions when width/height are absent', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 64 40"><rect/></svg>');
        expect(result.width).toBe(64);
        expect(result.height).toBe(40);
    });
    it("strips shapes' own fill/stroke so they inherit the wrapper paint", () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 10 10"><path d="M0 0" fill="#ff0000" stroke="blue"/></svg>');
        const src = result.svgSource.toLowerCase();
        // A shape's own presentation attribute beats the inherited wrapper
        // colour, so the hardcoded fill/stroke are removed — the shape then
        // inherits the element-level paint and recolours. The path stays, and
        // the source remains valid JSX (no inline style strings, no var()).
        expect(src).toContain('<path');
        expect(src).not.toContain('fill="#ff0000"');
        expect(src).not.toContain('stroke="blue"');
        expect(src).not.toContain('var(');
        expect(src).not.toContain('style=');
    });
    it('preserves fill="none" while stripping a solid stroke on the same shape', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 10 10"><circle r="4" fill="none" stroke="red"/></svg>');
        const src = result.svgSource.toLowerCase();
        // `none` is a deliberate "unpainted" intent — kept so the wrapper fill
        // can't paint it solid. The solid stroke is stripped so Stroke recolours.
        expect(src).toContain('fill="none"');
        expect(src).not.toContain('stroke="red"');
    });
    it('drops a fully-invisible bounding-box shape (fill=none AND stroke=none)', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M0 0h24v24H0z" fill="none" stroke="none"/><path d="M4 6h16"/></svg>');
        const src = result.svgSource;
        // The transparent box is gone; the stroked path remains.
        expect(src).not.toContain('M0 0h24v24H0z');
        expect(src).toContain('M4 6h16');
    });
    it('keeps a shape that is fill=none but visibly stroked', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 10 10"><circle r="4" fill="none" stroke="red"/></svg>');
        expect(result.svgSource).toContain('<circle');
    });
    it('hoists the root <svg> fill/stroke/stroke-width into element paint', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 24 24" fill="none" stroke="#00ff00" stroke-width="2"><path d="M0 0"/></svg>');
        expect(result.fill).toBe('none');
        expect(result.stroke).toBe('#00ff00');
        expect(result.strokeWidth).toBe(2);
    });
    it('sanitizes script content out of the prepared source', () => {
        const result = prepareSvgForInsert('<svg viewBox="0 0 10 10"><script>alert(1)</script><circle r="5"/></svg>');
        expect(result.svgSource.toLowerCase()).not.toContain('<script');
        expect(result.svgSource).toMatch(/<circle/i);
    });
    it('returns null for non-svg input', () => {
        expect(prepareSvgForInsert('<div>not svg</div>')).toBeNull();
        expect(prepareSvgForInsert('')).toBeNull();
        expect(prepareSvgForInsert('just text')).toBeNull();
    });
});
