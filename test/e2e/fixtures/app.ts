import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

import {
  createTestProject,
  type CreateTestProjectOptions,
  type TestProject,
} from './project';

/**
 * Replace `dialog.showOpenDialog` in the main process so the next call
 * resolves to `filePaths: [filePath]` without opening a native dialog.
 * Used by image-tool / background-image specs that would otherwise
 * hang on a real file picker. The patch lives for the rest of the
 * Electron session — tests should re-stub per scenario if needed.
 */
export const stubOpenDialog = async (
  app: ElectronApplication,
  filePath: string
): Promise<void> => {
  await app.evaluate(({ dialog }, p) => {
    const patched = async (): Promise<{ canceled: boolean; filePaths: string[] }> => ({
      canceled: false,
      filePaths: [p],
    });
    // Playwright gives us access to the live `dialog` module — override
    // both showOpenDialog and its sync variant just in case.
    dialog.showOpenDialog = patched as typeof dialog.showOpenDialog;
  }, filePath);
};

/**
 * Replace `dialog.showSaveDialog` so the next call returns
 * `filePath: <path>` without opening a native dialog. Used by export
 * specs that need a deterministic save target without a real picker.
 */
export const stubSaveDialog = async (
  app: ElectronApplication,
  filePath: string
): Promise<void> => {
  await app.evaluate(({ dialog }, p) => {
    const patched = async (): Promise<{ canceled: boolean; filePath: string }> => ({
      canceled: false,
      filePath: p,
    });
    dialog.showSaveDialog = patched as typeof dialog.showSaveDialog;
  }, filePath);
};

/** A minimal 1x1 PNG suitable for image-tool tests. */
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f00050001ff5ca2bf430000000049454e44ae426082',
  'hex'
);

export const writeFixtureImage = async (dir: string, name = 'pixel.png'): Promise<string> => {
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
 * Dismiss the first-launch Sentry crash-reporting prompt if it's
 * showing. The prompt mounts before any project / start-screen view
 * and would otherwise block every selector. Specs that build their
 * own `window` fixture (e.g. `settings/app-settings.spec.ts`) should
 * call this from inside their fixture so the prompt doesn't leak.
 */
export const dismissSentryPrompt = async (window: Page): Promise<void> => {
  const optOut = window.getByRole('button', { name: /^No thanks$/i });
  try {
    await optOut.waitFor({ state: 'visible', timeout: 2_000 });
    await optOut.click();
  } catch {
    // Not shown this run — already resolved, or IPC hasn't resolved
    // yet. Either way, nothing to do.
  }
};

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

/**
 * Test-level options. Specs override these via `test.use({...})` at
 * the top of the file or per-describe block. Example:
 *
 *   test.use({ projectOptions: { format: 'nextjs', components: [...] } });
 */
export type ScampOptions = {
  projectOptions: CreateTestProjectOptions;
};

export const test = base.extend<ScampFixtures & ScampOptions>({
  projectOptions: [{}, { option: true }],

  project: async ({ projectOptions }, use) => {
    const project = await createTestProject(projectOptions);
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
      // Belt-and-suspenders: kill any live ptys before tearing down
      // the Electron app. The main process also does this in its
      // `before-quit` handler, but if a spec timed out mid-pty-spawn
      // and node-pty's signal handling is being flaky on macOS, this
      // makes sure we don't sit waiting on a SIGTERM that the shell
      // is ignoring. See `src/main/ipc/terminal.ts:disposeAllTerminals`.
      await app
        .evaluate(async () => {
          const g = globalThis as { __scampDisposeTerminals?: () => Promise<void> };
          if (g.__scampDisposeTerminals) await g.__scampDisposeTerminals();
        })
        .catch(() => {
          // App may already be gone — that's fine, nothing to clean.
        });
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
    await dismissSentryPrompt(window);
    await use(window);
  },
});

export { expect } from '@playwright/test';
