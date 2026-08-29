import { describe, expect, it } from 'vitest';
import { clampToParent, MIN_SIZE } from '../src/renderer/lib/bounds';
describe('clampToParent', () => {
    it('returns a rect unchanged when it is fully inside the parent', () => {
        expect(clampToParent(10, 10, 50, 50, 200, 200)).toEqual({
            x: 10,
            y: 10,
            w: 50,
            h: 50,
        });
    });
    it('shifts a rect with negative x back to 0 and shrinks the width', () => {
        const result = clampToParent(-10, 0, 50, 50, 200, 200);
        expect(result.x).toBe(0);
        expect(result.w).toBe(40);
    });
    it('shifts a rect with negative y back to 0 and shrinks the height', () => {
        const result = clampToParent(0, -15, 50, 50, 200, 200);
        expect(result.y).toBe(0);
        expect(result.h).toBe(35);
    });
    it('shrinks width when the rect spills past the parent right edge', () => {
        const result = clampToParent(180, 0, 50, 50, 200, 200);
        expect(result.x).toBe(180);
        expect(result.w).toBe(20);
    });
    it('shrinks height when the rect spills past the parent bottom edge', () => {
        const result = clampToParent(0, 170, 50, 50, 200, 200);
        expect(result.y).toBe(170);
        expect(result.h).toBe(30);
    });
    it('enforces the minimum size floor', () => {
        const result = clampToParent(0, 0, 5, 5, 200, 200);
        expect(result.w).toBe(MIN_SIZE);
        expect(result.h).toBe(MIN_SIZE);
    });
    it('pulls the rect back in when the parent is wider than the rect plus overflow', () => {
        const result = clampToParent(250, 0, 50, 50, 200, 200);
        expect(result.x + result.w).toBeLessThanOrEqual(200);
    });
    it('is idempotent — clamping an already-clamped rect returns the same rect', () => {
        const once = clampToParent(-10, -10, 500, 500, 100, 100);
        const twice = clampToParent(once.x, once.y, once.w, once.h, 100, 100);
        expect(twice).toEqual(once);
    });
});
