import { type Page } from '@playwright/test';
export type PageFiles = {
    tsx: string;
    css: string;
};
export declare const readPageFiles: (projectDir: string, pageName: string) => Promise<PageFiles>;
export declare const projectFileExists: (projectDir: string, name: string) => Promise<boolean>;
/**
 * Wait until the save-status indicator lands on `saved`. The sync
 * bridge debounces writes ~200 ms, then the IPC round-trip + watcher
 * ack take another beat — settle time is usually <1 s in tests but
 * can spike on slow CI, so we give this a generous timeout.
 */
export declare const waitForSaved: (page: Page, timeout?: number) => Promise<void>;
