import { type Page } from '@playwright/test';
export type PageFiles = {
    tsx: string;
    css: string;
};
/**
 * The page's TSX and CSS module, wherever the project's format keeps
 * them: `views/<Name>/` in a framework project, `app/` in a Next.js
 * one, the root in a legacy one. Probed from disk so a spec reads the
 * same way under `SCAMP_E2E_FORMAT`.
 */
export declare const readPageFiles: (projectDir: string, pageName: string) => Promise<PageFiles>;
export declare const projectFileExists: (projectDir: string, name: string) => Promise<boolean>;
/**
 * Wait until the save-status indicator lands on `saved`. The sync
 * bridge debounces writes ~200 ms, then the IPC round-trip + watcher
 * ack take another beat — settle time is usually <1 s in tests but
 * can spike on slow CI, so we give this a generous timeout.
 */
export declare const waitForSaved: (page: Page, timeout?: number) => Promise<void>;
