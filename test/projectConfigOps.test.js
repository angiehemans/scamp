import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_FILE, readConfig, writeConfig, ensureProjectConfig, } from '../src/main/ipc/projectConfigOps';
import { DEFAULT_PROJECT_CONFIG } from '@shared/types';
describe('projectConfigOps', () => {
    let dir;
    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-config-ops-'));
    });
    afterEach(async () => {
        await fs.rm(dir, { recursive: true });
    });
    it('returns defaults when the config file is absent', async () => {
        expect(await readConfig(dir)).toEqual(DEFAULT_PROJECT_CONFIG);
    });
    it('round-trips a written config', async () => {
        const cfg = { ...DEFAULT_PROJECT_CONFIG, nextjsMigrationDismissed: true };
        await writeConfig(dir, cfg);
        expect(await readConfig(dir)).toEqual(cfg);
    });
    it('ensureProjectConfig backfills the file when missing', async () => {
        const before = await fs
            .access(path.join(dir, CONFIG_FILE))
            .then(() => true)
            .catch(() => false);
        expect(before).toBe(false);
        const result = await ensureProjectConfig(dir);
        expect(result).toEqual(DEFAULT_PROJECT_CONFIG);
        // The file now exists on disk.
        expect(await fs
            .access(path.join(dir, CONFIG_FILE))
            .then(() => true)
            .catch(() => false)).toBe(true);
    });
    it('ensureProjectConfig leaves an existing config untouched', async () => {
        const cfg = { ...DEFAULT_PROJECT_CONFIG, nextjsMigrationDismissed: true };
        await writeConfig(dir, cfg);
        expect(await ensureProjectConfig(dir)).toEqual(cfg);
    });
});
