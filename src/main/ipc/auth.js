import { app, ipcMain, safeStorage, shell, BrowserWindow } from 'electron';
import { IPC } from '@shared/ipcChannels';
import { cancelSignIn, getStatus, signIn, signOut, } from '../auth/authService';
/**
 * Sign-in handlers.
 *
 * The token never crosses this boundary. The renderer asks for a sign-in
 * and receives an identity; the credential itself stays in the main
 * process, which is also where authenticated requests will be made from.
 * see docs/plans/electron-sign-in-plan.md
 */
const deps = () => ({
    openExternal: async (url) => {
        await shell.openExternal(url);
    },
    // Node's fetch. The exchange sets an explicit `origin` because this has
    // none, unlike a browser request.
    fetchImpl: async (url, init) => {
        const res = await fetch(url, init);
        return { ok: res.ok, status: res.status, text: () => res.text() };
    },
    safeStorage,
    userDataDir: app.getPath('userData'),
    isPackaged: app.isPackaged,
});
/** Tell every window, so a second window reflects the change too. */
const broadcast = (channel, payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(channel, payload);
    }
};
export const registerAuthIpc = () => {
    ipcMain.handle(IPC.AuthStart, async () => {
        const outcome = await signIn(deps());
        if (outcome.status === 'signed-in') {
            broadcast(IPC.AuthComplete, { signedIn: true, user: outcome.user });
        }
        return outcome;
    });
    ipcMain.handle(IPC.AuthCancel, async () => cancelSignIn());
    ipcMain.handle(IPC.AuthStatus, async () => getStatus(deps()));
    ipcMain.handle(IPC.AuthSignOut, async () => {
        await signOut(deps());
        broadcast(IPC.AuthComplete, { signedIn: false });
    });
};
