import type { DevServerStatus } from '@shared/types';
type Listener = (status: DevServerStatus) => void;
export declare const ensureDevServer: (projectPath: string) => Promise<DevServerStatus>;
/**
 * Kill the dev server for a project and remove it from the cache.
 * Safe to call when no server is running.
 */
export declare const stopDevServer: (projectPath: string) => Promise<void>;
/**
 * Stop every dev server. Used on app quit and when the user closes
 * a project (kills only that project's servers — see lifecycle
 * wiring in main/index.ts).
 */
export declare const stopAllDevServers: () => Promise<void>;
/** Current status snapshot, or `idle` when no entry exists. */
export declare const getDevServerStatus: (projectPath: string) => DevServerStatus;
/**
 * Subscribe to status changes for a project. Returns an unsubscribe
 * function. Auto-creates an entry so the preview window can listen
 * before `ensureDevServer` is invoked (avoids a race on first open).
 */
export declare const subscribeDevServer: (projectPath: string, listener: Listener) => (() => void);
/**
 * Restart a crashed (or running) dev server for a project. Stops
 * the existing process and re-runs `ensureDevServer`. Used by the
 * preview window's Restart button.
 */
export declare const restartDevServer: (projectPath: string) => Promise<DevServerStatus>;
export {};
