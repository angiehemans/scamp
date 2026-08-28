import { app, ipcMain, safeStorage, shell, BrowserWindow } from 'electron';

import { IPC } from '@shared/ipcChannels';
import type { AuthSignInResult, AuthStatusResult } from '@shared/types';

import {
  cancelSignIn,
  getStatus,
  signIn,
  signOut,
  type AuthDeps,
} from '../auth/authService';

/**
 * Sign-in handlers.
 *
 * The token never crosses this boundary. The renderer asks for a sign-in
 * and receives an identity; the credential itself stays in the main
 * process, which is also where authenticated requests will be made from.
 * see docs/plans/electron-sign-in-plan.md
 */

const deps = (): AuthDeps => ({
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
const broadcast = (channel: string, payload: unknown): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
};

export const registerAuthIpc = (): void => {
  ipcMain.handle(IPC.AuthStart, async (): Promise<AuthSignInResult> => {
    const outcome = await signIn(deps());
    if (outcome.status === 'signed-in') {
      broadcast(IPC.AuthComplete, { signedIn: true, user: outcome.user });
    }
    return outcome;
  });

  ipcMain.handle(IPC.AuthCancel, async (): Promise<void> => cancelSignIn());

  ipcMain.handle(IPC.AuthStatus, async (): Promise<AuthStatusResult> =>
    getStatus(deps())
  );

  ipcMain.handle(IPC.AuthSignOut, async (): Promise<void> => {
    await signOut(deps());
    broadcast(IPC.AuthComplete, { signedIn: false });
  });
};
