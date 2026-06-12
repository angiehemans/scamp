import type { Settings } from '@shared/types';
export declare const DEFAULT_SETTINGS: Settings;
/**
 * Parse a Settings JSON blob with migration / defaulting. Pure so the
 * sync startup read and the async IPC read share one source of truth,
 * and so it can be unit-tested without touching Electron's userData
 * path. Any structural surprise falls back to a default.
 */
export declare const parseSettingsBlob: (raw: string) => Settings;
