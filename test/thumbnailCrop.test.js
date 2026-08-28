import { describe, it, expect } from 'vitest';
import { needsBackfill, THUMBNAIL_ASPECT, THUMBNAIL_MAX_WIDTH, thumbnailFrame, } from '../src/renderer/lib/thumbnailCrop';
/**
 * The behaviour that matters here is what happens to page shapes that are
 * nothing like a card: very tall pages (the common case), pages shorter
 * than the card, and pages narrower than the stored width.
 */
describe('thumbnailFrame', () => {
    it('crops a tall page to the card aspect, from the top', () => {
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 4000 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.sy).toBe(0);
        expect(frame.sWidth).toBe(1280);
        // 640 wide at 16:10 is 400 tall, which is 800 source px at half scale.
        expect(frame.outWidth).toBe(640);
        expect(frame.outHeight).toBe(400);
        expect(frame.sHeight).toBe(800);
    });
    it('fills the frame exactly when the page is tall enough', () => {
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 4000 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.dHeight).toBe(frame.outHeight);
        expect(needsBackfill(frame)).toBe(false);
    });
    it('leaves room to backfill when the page is shorter than the card', () => {
        // A 1280×400 page is wider than 16:10, so it cannot fill the frame
        // without cropping width — which would cut the layout in half.
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 400 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.sHeight).toBe(400);
        expect(frame.dHeight).toBe(200);
        expect(frame.outHeight).toBe(400);
        expect(needsBackfill(frame)).toBe(true);
    });
    it('never crops horizontally', () => {
        // Cutting the sides off a page loses the layout, which is the thing
        // the thumbnail exists to show.
        for (const sourceHeight of [100, 800, 4000]) {
            const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight });
            if (frame === null)
                throw new Error('expected a frame');
            expect(frame.sx).toBe(0);
            expect(frame.sWidth).toBe(1280);
            expect(frame.dWidth).toBe(frame.outWidth);
        }
    });
    it('does not upscale a page narrower than the stored width', () => {
        const frame = thumbnailFrame({ sourceWidth: 320, sourceHeight: 900 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.outWidth).toBe(320);
        expect(frame.outHeight).toBe(200);
    });
    it('keeps the target aspect whatever the source shape', () => {
        const shapes = [
            [1280, 4000],
            [1280, 100],
            [320, 900],
            [77, 3],
        ];
        for (const [w, h] of shapes) {
            const frame = thumbnailFrame({ sourceWidth: w, sourceHeight: h });
            if (frame === null)
                throw new Error('expected a frame');
            expect(frame.outWidth / frame.outHeight).toBeCloseTo(THUMBNAIL_ASPECT, 1);
        }
    });
    it('produces whole-pixel output dimensions', () => {
        // Fractional canvas dimensions are silently truncated by the browser,
        // which would put the aspect a pixel off and letterbox the card.
        const frame = thumbnailFrame({ sourceWidth: 1237, sourceHeight: 3311 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(Number.isInteger(frame.outWidth)).toBe(true);
        expect(Number.isInteger(frame.outHeight)).toBe(true);
        expect(Number.isInteger(frame.dHeight)).toBe(true);
    });
    it('never asks for more source than there is', () => {
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 150 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.sHeight).toBeLessThanOrEqual(150);
    });
    it('returns null for a zero-width source', () => {
        // Normal during teardown — the caller skips rather than erroring.
        expect(thumbnailFrame({ sourceWidth: 0, sourceHeight: 900 })).toBeNull();
    });
    it('returns null for a zero-height source', () => {
        expect(thumbnailFrame({ sourceWidth: 1280, sourceHeight: 0 })).toBeNull();
    });
    it('returns null for negative dimensions', () => {
        expect(thumbnailFrame({ sourceWidth: -10, sourceHeight: 900 })).toBeNull();
        expect(thumbnailFrame({ sourceWidth: 1280, sourceHeight: -1 })).toBeNull();
    });
    it('returns null for NaN dimensions', () => {
        expect(thumbnailFrame({ sourceWidth: Number.NaN, sourceHeight: 900 })).toBeNull();
        expect(thumbnailFrame({ sourceWidth: 1280, sourceHeight: Number.NaN })).toBeNull();
    });
    it('returns null for an unusable aspect or width', () => {
        expect(thumbnailFrame({ sourceWidth: 1280, sourceHeight: 900, aspect: 0 })).toBeNull();
        expect(thumbnailFrame({ sourceWidth: 1280, sourceHeight: 900, maxWidth: 0 })).toBeNull();
    });
    it('honours a caller-supplied aspect and width', () => {
        const frame = thumbnailFrame({
            sourceWidth: 1000,
            sourceHeight: 5000,
            aspect: 1,
            maxWidth: 200,
        });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.outWidth).toBe(200);
        expect(frame.outHeight).toBe(200);
    });
    it('defaults to a 640px 16:10 frame', () => {
        expect(THUMBNAIL_MAX_WIDTH).toBe(640);
        const frame = thumbnailFrame({ sourceWidth: 2000, sourceHeight: 2000 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(frame.outWidth).toBe(THUMBNAIL_MAX_WIDTH);
        expect(frame.outHeight).toBe(400);
    });
});
describe('needsBackfill', () => {
    it('is false when the drawn region covers the frame', () => {
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 4000 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(needsBackfill(frame)).toBe(false);
    });
    it('is true when the page ran out before the bottom of the frame', () => {
        const frame = thumbnailFrame({ sourceWidth: 1280, sourceHeight: 300 });
        if (frame === null)
            throw new Error('expected a frame');
        expect(needsBackfill(frame)).toBe(true);
    });
});
