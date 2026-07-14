import { type ElectronApplication, type Page } from '@playwright/test';
import { type CreateTestProjectOptions, type TestProject } from './project';
/**
 * Replace `dialog.showOpenDialog` in the main process so the next call
 * resolves to `filePaths: [filePath]` without opening a native dialog.
 * Used by image-tool / background-image specs that would otherwise
 * hang on a real file picker. The patch lives for the rest of the
 * Electron session — tests should re-stub per scenario if needed.
 */
export declare const stubOpenDialog: (app: ElectronApplication, filePath: string) => Promise<void>;
/**
 * Replace `dialog.showSaveDialog` so the next call returns
 * `filePath: <path>` without opening a native dialog. Used by export
 * specs that need a deterministic save target without a real picker.
 */
export declare const stubSaveDialog: (app: ElectronApplication, filePath: string) => Promise<void>;
export declare const writeFixtureImage: (dir: string, name?: string) => Promise<string>;
export declare const writeFixtureSvg: (name?: string, content?: string) => Promise<string>;
/**
 * Dismiss the first-launch Sentry crash-reporting prompt if it's
 * showing. The prompt mounts before any project / start-screen view
 * and would otherwise block every selector. Specs that build their
 * own `window` fixture (e.g. `settings/app-settings.spec.ts`) should
 * call this from inside their fixture so the prompt doesn't leak.
 */
export declare const dismissSentryPrompt: (window: Page) => Promise<void>;
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
export declare const test: import("playwright/test").TestType<import("playwright/test").PlaywrightTestArgs & import("playwright/test").PlaywrightTestOptions & ScampFixtures & ScampOptions, import("playwright/test").PlaywrightWorkerArgs & import("playwright/test").PlaywrightWorkerOptions>;
export { expect } from '@playwright/test';
