import { describe, it, expect } from 'vitest';
import { createExternalEditTracker } from '@renderer/src/lib/externalEditTracker';
const HOME_TSX = '/proj/app/page.tsx';
const HOME_CSS = '/proj/app/page.module.css';
const ABOUT_TSX = '/proj/app/about/page.tsx';
const ABOUT_CSS = '/proj/app/about/page.module.css';
describe('externalEditTracker', () => {
    it('starts empty — nothing is pending for any sibling pair', () => {
        const t = createExternalEditTracker();
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(false);
        expect(t.isPending(ABOUT_TSX, ABOUT_CSS)).toBe(false);
    });
    it('mark + isPending — true after either sibling is marked', () => {
        const t = createExternalEditTracker();
        t.mark(HOME_TSX);
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(true);
        const t2 = createExternalEditTracker();
        t2.mark(HOME_CSS);
        expect(t2.isPending(HOME_TSX, HOME_CSS)).toBe(true);
    });
    it('markPair — both siblings count as pending', () => {
        const t = createExternalEditTracker();
        t.markPair(HOME_TSX, HOME_CSS);
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(true);
        expect(t.isPending(ABOUT_TSX, ABOUT_CSS)).toBe(false);
    });
    it('clear releases the pending flag', () => {
        const t = createExternalEditTracker();
        t.markPair(HOME_TSX, HOME_CSS);
        t.clear(HOME_TSX);
        // Still pending — the other sibling is still marked.
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(true);
        t.clear(HOME_CSS);
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(false);
    });
    it('clearPair releases both siblings at once', () => {
        const t = createExternalEditTracker();
        t.markPair(HOME_TSX, HOME_CSS);
        t.clearPair(HOME_TSX, HOME_CSS);
        expect(t.isPending(HOME_TSX, HOME_CSS)).toBe(false);
    });
    it('per-pair isolation — marking home does not affect about', () => {
        const t = createExternalEditTracker();
        t.markPair(HOME_TSX, HOME_CSS);
        expect(t.isPending(ABOUT_TSX, ABOUT_CSS)).toBe(false);
    });
    it('mark + clear are idempotent — marking twice / clearing missing path is fine', () => {
        const t = createExternalEditTracker();
        t.mark(HOME_TSX);
        t.mark(HOME_TSX);
        expect(t.snapshot().size).toBe(1);
        t.clear('/nonexistent');
        expect(t.snapshot().size).toBe(1);
        t.clear(HOME_TSX);
        expect(t.snapshot().size).toBe(0);
    });
    it('separate instances do not share state', () => {
        const a = createExternalEditTracker();
        const b = createExternalEditTracker();
        a.markPair(HOME_TSX, HOME_CSS);
        expect(a.isPending(HOME_TSX, HOME_CSS)).toBe(true);
        expect(b.isPending(HOME_TSX, HOME_CSS)).toBe(false);
    });
});
