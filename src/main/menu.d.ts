import { Menu } from 'electron';
/**
 * Build the GitHub new-issue URL with version + OS pre-filled in
 * the body. The renderer never sees this URL — we open it from
 * main via `shell.openExternal` so the user lands in their
 * default browser.
 */
export declare const buildBugReportUrl: () => string;
export declare const buildApplicationMenu: () => Menu;
