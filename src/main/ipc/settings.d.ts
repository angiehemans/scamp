import type { Settings } from '@shared/types';
/**
 * Synchronous read for the main process's startup path. Sentry's
 * `init()` decision needs to happen before the BrowserWindow is
 * created, which means before `app.whenReady`'s promise can
 * resolve an async read. Sync + try/catch + defaults is the
 * safest shape — any error (file missing, malformed JSON, perm
 * issue) returns the defaults with `sentryOptIn: null` so the
 * renderer's opt-in prompt fires.
 */
export declare const readSettingsSync: () => Settings;
declare const getSettings: () => Promise<Settings>;
export declare const registerSettingsIpc: () => void;
export { getSettings };
