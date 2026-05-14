import { describe, it, expect, vi } from 'vitest';
// Mock electron's `app` because `src/main/sentry.ts` imports it at
// module load. We don't exercise the parts that call into app here —
// just the pure `scrubPaths` helper — but the import has to resolve.
vi.mock('electron', () => ({
    app: { getVersion: () => '0.0.0-test', isPackaged: false },
}));
// Mock @sentry/electron/main so the module load doesn't try to wire
// into the real SDK at unit-test time. We're not asserting against
// Sentry.init behaviour here; that needs an integration harness.
vi.mock('@sentry/electron/main', () => ({
    init: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
}));
const { scrubPaths } = await import('../src/main/sentry');
describe('scrubPaths', () => {
    it('returns undefined unchanged', () => {
        expect(scrubPaths(undefined)).toBeUndefined();
    });
    it('returns empty string unchanged', () => {
        expect(scrubPaths('')).toBe('');
    });
    it('redacts macOS user paths', () => {
        expect(scrubPaths('/Users/angie/projects/foo.tsx')).toBe('/Users/[redacted]/projects/foo.tsx');
    });
    it('redacts multiple macOS paths in the same string', () => {
        expect(scrubPaths('Error at /Users/angie/a.tsx referenced /Users/bob/b.tsx')).toBe('Error at /Users/[redacted]/a.tsx referenced /Users/[redacted]/b.tsx');
    });
    it('redacts Linux home paths', () => {
        expect(scrubPaths('/home/angie/code/scamp/src/main.ts')).toBe('/home/[redacted]/code/scamp/src/main.ts');
    });
    it('redacts Windows user paths', () => {
        expect(scrubPaths('C:\\Users\\Angie\\Documents\\foo.tsx')).toBe('C:\\Users\\[redacted]\\Documents\\foo.tsx');
    });
    it('leaves paths that do not match any user-home pattern untouched', () => {
        expect(scrubPaths('/Applications/Scamp.app/Contents/Resources/app.asar')).toBe('/Applications/Scamp.app/Contents/Resources/app.asar');
        expect(scrubPaths('/var/log/system.log')).toBe('/var/log/system.log');
        expect(scrubPaths('C:\\Windows\\System32\\cmd.exe')).toBe('C:\\Windows\\System32\\cmd.exe');
    });
    it('redacts paths embedded in error messages', () => {
        expect(scrubPaths('TypeError: cannot read property "x" of undefined at /Users/angie/code/foo.tsx:42:10')).toBe('TypeError: cannot read property "x" of undefined at /Users/[redacted]/code/foo.tsx:42:10');
    });
});
