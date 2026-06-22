import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { IPC } from '@shared/ipcChannels';
/** Re-check cadence while the app stays open (the first check is on launch). */
const FOUR_HOURS = 4 * 60 * 60 * 1000;
/** Listeners + the polling interval are bound to the first window only. */
let registered = false;
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
export const initAutoUpdater = (mainWindow) => {
    if (!app.isPackaged || registered)
        return;
    registered = true;
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    const send = (channel, payload) => {
        if (mainWindow.isDestroyed())
            return;
        mainWindow.webContents.send(channel, payload);
    };
    autoUpdater.on('checking-for-update', () => {
        send(IPC.UpdaterChecking);
    });
    autoUpdater.on('update-available', (info) => {
        const payload = { version: info.version };
        send(IPC.UpdaterAvailable, payload);
    });
    autoUpdater.on('update-not-available', () => {
        send(IPC.UpdaterNotAvailable);
    });
    autoUpdater.on('download-progress', (progress) => {
        const payload = {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond,
        };
        send(IPC.UpdaterProgress, payload);
    });
    autoUpdater.on('update-downloaded', (info) => {
        const payload = { version: info.version };
        send(IPC.UpdaterDownloaded, payload);
    });
    autoUpdater.on('error', (err) => {
        log.error('[updater] error:', err);
        send(IPC.UpdaterError, err.message);
    });
    // Check once on launch, then every 4 hours while the app stays open.
    void autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => {
        void autoUpdater.checkForUpdatesAndNotify();
    }, FOUR_HOURS);
};
