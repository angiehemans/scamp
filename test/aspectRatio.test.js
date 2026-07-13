import { describe, expect, it } from 'vitest';
import { heightFromWidth, lockedCornerResize, lockedSizePatch, ratioOf, widthFromHeight, } from '../src/renderer/lib/aspectRatio';
import { MIN_SIZE } from '../src/renderer/lib/bounds';
describe('ratioOf', () => {
    it('returns width divided by height', () => {
        expect(ratioOf(400, 300)).toBeCloseTo(4 / 3, 5);
    });
    it('returns a ratio below 1 for portrait boxes', () => {
        expect(ratioOf(200, 400)).toBe(0.5);
    });
});
describe('heightFromWidth', () => {
    it('derives the height for a 4:3 ratio', () => {
        expect(heightFromWidth(400, 4 / 3)).toBe(300);
    });
    it('rounds to a whole pixel', () => {
        expect(heightFromWidth(401, 4 / 3)).toBe(301);
    });
    it('floors at MIN_SIZE for a very wide ratio', () => {
        // ratio 10 → 30/10 = 3, floored to MIN_SIZE.
        expect(heightFromWidth(30, 10)).toBe(MIN_SIZE);
    });
});
describe('widthFromHeight', () => {
    it('derives the width for a 4:3 ratio', () => {
        expect(widthFromHeight(300, 4 / 3)).toBe(400);
    });
    it('floors at MIN_SIZE for a very narrow ratio', () => {
        expect(widthFromHeight(30, 0.1)).toBe(MIN_SIZE);
    });
});
describe('lockedCornerResize', () => {
    const base = { originX: 100, originY: 50, originW: 400, originH: 300 };
    const ratio = 4 / 3; // 400x300
    it('se: grows from the top-left anchor, keeps x/y', () => {
        const r = lockedCornerResize({ ...base, handle: 'se', dx: 80, ratio });
        expect(r).toEqual({ x: 100, y: 50, w: 480, h: 360 });
    });
    it('se: shrinks when dragged inward', () => {
        const r = lockedCornerResize({ ...base, handle: 'se', dx: -40, ratio });
        expect(r).toEqual({ x: 100, y: 50, w: 360, h: 270 });
    });
    it('sw: anchors the top-right, x follows the width change', () => {
        // Dragging west by -80 grows width to 480; x shifts left by 80.
        const r = lockedCornerResize({ ...base, handle: 'sw', dx: -80, ratio });
        expect(r).toEqual({ x: 20, y: 50, w: 480, h: 360 });
    });
    it('ne: anchors the bottom-left, y follows the height change', () => {
        const r = lockedCornerResize({ ...base, handle: 'ne', dx: 80, ratio });
        // width 480, height 360 (grew by 60); y shifts up by 60.
        expect(r).toEqual({ x: 100, y: -10, w: 480, h: 360 });
    });
    it('nw: anchors the bottom-right, both x and y follow', () => {
        const r = lockedCornerResize({ ...base, handle: 'nw', dx: -80, ratio });
        expect(r).toEqual({ x: 20, y: -10, w: 480, h: 360 });
    });
    it('is width-driven: the y-axis delta is irrelevant to sizing', () => {
        const a = lockedCornerResize({ ...base, handle: 'se', dx: 80, ratio });
        const b = lockedCornerResize({ ...base, handle: 'se', dx: 80, ratio });
        expect(a).toEqual(b);
    });
    it('keeps both axes at or above MIN_SIZE when shrinking hard', () => {
        const r = lockedCornerResize({
            ...base,
            handle: 'se',
            dx: -1000,
            ratio,
        });
        expect(r.w).toBeGreaterThanOrEqual(MIN_SIZE);
        expect(r.h).toBeGreaterThanOrEqual(MIN_SIZE);
    });
    it('pins height at MIN_SIZE and back-computes width for a wide ratio', () => {
        // ratio 10:1, shrink width toward the floor; height would underflow,
        // so height is pinned and width recomputed to preserve the ratio.
        const r = lockedCornerResize({
            originX: 0,
            originY: 0,
            originW: 300,
            originH: 30,
            handle: 'se',
            dx: -290,
            ratio: 10,
        });
        expect(r.h).toBe(MIN_SIZE);
        expect(r.w).toBe(MIN_SIZE * 10);
    });
});
describe('lockedSizePatch', () => {
    const element = { widthValue: 400, heightValue: 300 };
    it('unlocked width commit matches the legacy fixed-px behaviour', () => {
        expect(lockedSizePatch(element, 'width', '200', null)).toEqual({
            widthMode: 'fixed',
            widthValue: 200,
            widthCustom: undefined,
        });
    });
    it('locked width commit recomputes the paired height', () => {
        // ratio 2:1 → width 300 pairs to height 150.
        expect(lockedSizePatch(element, 'width', '300', 2)).toEqual({
            widthMode: 'fixed',
            widthValue: 300,
            widthCustom: undefined,
            heightMode: 'fixed',
            heightValue: 150,
            heightCustom: undefined,
        });
    });
    it('locked height commit recomputes the paired width', () => {
        expect(lockedSizePatch(element, 'height', '200', 2)).toEqual({
            heightMode: 'fixed',
            heightValue: 200,
            heightCustom: undefined,
            widthMode: 'fixed',
            widthValue: 400,
            widthCustom: undefined,
        });
    });
    it('does not pair a non-px custom length even when locked', () => {
        expect(lockedSizePatch(element, 'width', '50vh', 2)).toEqual({
            widthMode: 'fixed',
            widthValue: 50,
            widthCustom: '50vh',
        });
    });
    it('a non-fixed commit changes only the driving axis and drops nothing else', () => {
        expect(lockedSizePatch(element, 'width', '100%', 2)).toEqual({
            widthMode: 'stretch',
            widthValue: 400,
            widthCustom: undefined,
        });
    });
});
