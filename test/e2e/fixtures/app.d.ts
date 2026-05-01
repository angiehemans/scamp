import { type ElectronApplication, type Page } from '@playwright/test';
import { type TestProject } from './project';
/**
 * Replace `dialog.showOpenDialog` in the main process so the next call
 * resolves to `filePaths: [filePath]` without opening a native dialog.
 * Used by image-tool / background-image specs that would otherwise
 * hang on a real file picker. The patch lives for the rest of the
 * Electron session — tests should re-stub per scenario if needed.
 */
export declare const stubOpenDialog: (app: ElectronApplication, filePath: string) => Promise<void>;
export declare const writeFixtureImage: (dir: string, name?: string) => Promise<string>;
export type ScampFixtures = {
    project: TestProject;
    app: ElectronApplication;
    window: Page;
};
export declare const test: import("playwright/test").TestType<import("playwright/test").PlaywrightTestArgs & import("playwright/test").PlaywrightTestOptions & ScampFixtures, import("playwright/test").PlaywrightWorkerArgs & import("playwright/test").PlaywrightWorkerOptions>;
export { expect } from '@playwright/test';
