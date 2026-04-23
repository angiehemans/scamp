import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

import { createTestProject, type TestProject } from './project';

/**
 * Path to the built Electron main entry. `npm run build` must have been
 * executed before launching — Playwright doesn't start the dev server.
 */
const MAIN_ENTRY = path.resolve(__dirname, '../../../out/main/index.js');

/**
 * Isolated `userData` dir per spec so recent-projects history and app
 * settings don't bleed between tests or into the real profile.
 */
const makeUserDataDir = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), 'scamp-e2e-userdata-'));

export type ScampFixtures = {
  project: TestProject;
  app: ElectronApplication;
  window: Page;
};

export const test = base.extend<ScampFixtures>({
  project: async ({}, use) => {
    const project = await createTestProject();
    try {
      await use(project);
    } finally {
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
    } finally {
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
