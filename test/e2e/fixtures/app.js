import { test as base, _electron as electron } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createTestProject } from './project';
/**
 * Replace `dialog.showOpenDialog` in the main process so the next call
 * resolves to `filePaths: [filePath]` without opening a native dialog.
 * Used by image-tool / background-image specs that would otherwise
 * hang on a real file picker. The patch lives for the rest of the
 * Electron session — tests should re-stub per scenario if needed.
 */
export const stubOpenDialog = async (app, filePath) => {
    await app.evaluate(({ dialog }, p) => {
        const patched = async () => ({
            canceled: false,
            filePaths: [p],
        });
        // Playwright gives us access to the live `dialog` module — override
        // both showOpenDialog and its sync variant just in case.
        dialog.showOpenDialog = patched;
    }, filePath);
};
/** A minimal 1x1 PNG suitable for image-tool tests. */
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f00050001ff5ca2bf430000000049454e44ae426082', 'hex');
export const writeFixtureImage = async (dir, name = 'pixel.png') => {
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, PNG_BYTES);
    return filePath;
};
/**
 * Path to the built Electron main entry. `npm run build` must have been
 * executed before launching — Playwright doesn't start the dev server.
 */
const MAIN_ENTRY = path.resolve(__dirname, '../../../out/main/index.js');
/**
 * Isolated `userData` dir per spec so recent-projects history and app
 * settings don't bleed between tests or into the real profile.
 */
const makeUserDataDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-userdata-'));
export const test = base.extend({
    project: async ({}, use) => {
        const project = await createTestProject();
        try {
            await use(project);
        }
        finally {
            await project.cleanup();
        }
    },
    app: async ({ project }, use) => {
        const userDataDir = await makeUserDataDir();
        const app = await electron.launch({
            args: [MAIN_ENTRY, `--user-data-dir=${userDataDir}`],
            env: {
                ...process.env,
                SCAMP_E2E: '1',
                SCAMP_E2E_OPEN_PROJECT: project.dir,
                NODE_ENV: 'test',
            },
        });
        try {
            await use(app);
        }
        finally {
            await app.close().catch(() => {
                // Swallow close errors — they're expected when a spec fails mid-run.
            });
            await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {
                // Best-effort cleanup.
            });
        }
    },
    window: async ({ app }, use) => {
        const window = await app.firstWindow();
        await window.waitForLoadState('domcontentloaded');
        await use(window);
    },
});
export { expect } from '@playwright/test';
