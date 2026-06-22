import { type BrowserWindow } from 'electron';
/**
 * Wire electron-updater to the renderer. Status events are forwarded
 * over IPC so the in-app banner can show download progress and the
 * "ready to install" prompt. Updates download silently in the
 * background; the user is only interrupted once one is ready, and
 * `autoInstallOnAppQuit` means a dismissed update still lands on the
 * next launch. See docs/notes/auto-update.md.
 *
 * No-op in development / unpackaged builds — electron-updater has no
 * release feed to read there and would only log errors.
 */
export declare const initAutoUpdater: (mainWindow: BrowserWindow) => void;
