import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { themePathFor, readThemeFile, writeThemeFile, } from '../src/main/ipc/themeOps';
describe('themePathFor', () => {
    it('puts theme.css under app/ for nextjs projects', () => {
        expect(themePathFor('/p', 'nextjs')).toBe(path.join('/p', 'app', 'theme.css'));
    });
    it('keeps theme.css at the project root for legacy projects', () => {
        expect(themePathFor('/p', 'legacy')).toBe(path.join('/p', 'theme.css'));
    });
});
describe('readThemeFile / writeThemeFile', () => {
    let dir;
    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-ops-'));
    });
    afterEach(async () => {
        await fs.rm(dir, { recursive: true });
    });
    it('round-trips written content (legacy)', async () => {
        await writeThemeFile(dir, 'legacy', ':root { --a: 1; }');
        expect(await readThemeFile(dir, 'legacy')).toBe(':root { --a: 1; }');
    });
    it('round-trips written content (nextjs, under app/)', async () => {
        await fs.mkdir(path.join(dir, 'app'), { recursive: true });
        await writeThemeFile(dir, 'nextjs', ':root { --b: 2; }');
        expect(await readThemeFile(dir, 'nextjs')).toBe(':root { --b: 2; }');
        // Confirms the file actually landed under app/.
        expect(await fs.readFile(path.join(dir, 'app', 'theme.css'), 'utf-8')).toBe(':root { --b: 2; }');
    });
    it('returns empty string when the file is missing', async () => {
        expect(await readThemeFile(dir, 'legacy')).toBe('');
    });
});
