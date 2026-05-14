import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
// Mock electron.app to return a controlled tmpdir for userData. We
// create a fresh tmpdir per test so file content from one test
// doesn't leak into the next.
let userDataDir;
vi.mock('electron', () => ({
    app: {
        getPath: (_) => userDataDir,
    },
    ipcMain: { handle: vi.fn() },
}));
const { readSettingsSync } = await import('../src/main/ipc/settings');
describe('readSettingsSync', () => {
    beforeEach(() => {
        userDataDir = mkdtempSync(join(tmpdir(), 'scamp-settings-test-'));
    });
    afterEach(() => {
        rmSync(userDataDir, { recursive: true, force: true });
    });
    it('returns defaults with sentryOptIn=null when settings.json is missing', () => {
        const s = readSettingsSync();
        expect(s.defaultProjectsFolder).toBeNull();
        expect(s.sentryOptIn).toBeNull();
    });
    it('returns defaults with sentryOptIn=null when settings.json is malformed JSON', () => {
        writeFileSync(join(userDataDir, 'settings.json'), '{ not valid json', 'utf-8');
        const s = readSettingsSync();
        expect(s.sentryOptIn).toBeNull();
    });
    it('returns defaults with sentryOptIn=null when settings.json is not an object', () => {
        writeFileSync(join(userDataDir, 'settings.json'), 'null', 'utf-8');
        const s = readSettingsSync();
        expect(s.sentryOptIn).toBeNull();
    });
    it('returns sentryOptIn=true when the stored value is true', () => {
        writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ sentryOptIn: true }), 'utf-8');
        expect(readSettingsSync().sentryOptIn).toBe(true);
    });
    it('returns sentryOptIn=false when the stored value is false', () => {
        writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ sentryOptIn: false }), 'utf-8');
        expect(readSettingsSync().sentryOptIn).toBe(false);
    });
    it('returns sentryOptIn=null when the key is present but not a boolean', () => {
        writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({ sentryOptIn: 'yes' }), 'utf-8');
        expect(readSettingsSync().sentryOptIn).toBeNull();
    });
    it('preserves defaultProjectsFolder alongside sentryOptIn', () => {
        writeFileSync(join(userDataDir, 'settings.json'), JSON.stringify({
            defaultProjectsFolder: '/home/me/projects',
            sentryOptIn: true,
        }), 'utf-8');
        const s = readSettingsSync();
        expect(s.defaultProjectsFolder).toBe('/home/me/projects');
        expect(s.sentryOptIn).toBe(true);
    });
});
