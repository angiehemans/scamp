import { describe, it, expect } from 'vitest';
import { detectReady, detectScampReady } from '../src/main/devServer/readyDetector';
describe('detectReady', () => {
    it('returns false for empty input', () => {
        expect(detectReady('')).toBe(false);
    });
    it('returns false for the Next.js banner alone (no Local URL or Ready line)', () => {
        expect(detectReady('▲ Next.js 15.0.0\n')).toBe(false);
    });
    it('matches the "✓ Ready in" line (Next.js 15+)', () => {
        const stdout = `▲ Next.js 15.0.0
- Local:        http://localhost:3001
✓ Ready in 542ms
`;
        expect(detectReady(stdout)).toBe(true);
    });
    it('matches a leading "Local:" URL line by itself', () => {
        expect(detectReady('   - Local:        http://localhost:3001\n')).toBe(true);
    });
    it('matches "Local:" URL with the bullet variants Next ships', () => {
        expect(detectReady('▲ Local: http://localhost:5173')).toBe(true);
        expect(detectReady('► Local: http://localhost:5173')).toBe(true);
    });
    it('matches case-insensitively', () => {
        expect(detectReady('local: http://localhost:3000\n')).toBe(true);
        expect(detectReady('✓ READY IN 100ms')).toBe(true);
    });
    it('does not false-positive on stack traces or random output containing "ready"', () => {
        expect(detectReady('Error: notReady to start\n')).toBe(false);
        // No leading bullet AND no checkmark — bare word "Ready" alone
        // shouldn't trigger.
        expect(detectReady('not Ready in the way you think\n')).toBe(false);
    });
});
describe('detectScampReady', () => {
    it('returns the port from the exact readiness line scamp dev prints', () => {
        expect(detectScampReady('scamp dev ready http://127.0.0.1:41337\n')).toBe(41337);
    });
    it('finds the line after earlier output that landed in the buffer', () => {
        expect(detectScampReady('vite warn: something\nscamp dev ready http://127.0.0.1:3000\n')).toBe(3000);
    });
    it('ignores partial lines, other hosts, and the Next.js signals', () => {
        expect(detectScampReady('scamp dev ready http://127.0.0.1:')).toBeNull();
        expect(detectScampReady('scamp dev ready http://localhost:3000\n')).toBeNull();
        expect(detectScampReady('- Local: http://localhost:3000\n✓ Ready in 5ms\n')).toBeNull();
        expect(detectScampReady('')).toBeNull();
    });
    it('is not matched by the Next.js detector', () => {
        expect(detectReady('scamp dev ready http://127.0.0.1:3000\n')).toBe(false);
    });
});
