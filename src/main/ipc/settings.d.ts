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
/**
 * Persist a freshly-generated install id. Separate from `updateSettings` so
 * the Sentry init path can save an id it just minted without racing a
 * renderer-driven settings write.
 */
export declare const persistInstallId: (installId: string) => Promise<void>;
export declare const registerSettingsIpc: () => void;
export { getSettings };
