import { app, BrowserWindow, ipcMain, nativeTheme, net, protocol, session, shell } from 'electron';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { TestBootstrap } from '@shared/types';
import { registerProjectIpc } from './ipc/project';
import { registerFileIpc } from './ipc/file';
import { registerPageIpc } from './ipc/page';
import { registerRecentProjectsIpc } from './ipc/recentProjects';
import { registerSettingsIpc } from './ipc/settings';
import { registerProjectConfigIpc } from './ipc/projectConfig';
import { registerTerminalIpc, disposeAllTerminals } from './ipc/terminal';
import { registerThemeIpc } from './ipc/theme';
import { registerImageIpc } from './ipc/image';
import { initWatcher, disposeWatcher } from './watcher';

const TEST_BOOTSTRAP: TestBootstrap = {
  e2e: process.env['SCAMP_E2E'] === '1',
  autoOpenProjectPath:
    process.env['SCAMP_E2E'] === '1'
      ? process.env['SCAMP_E2E_OPEN_PROJECT'] ?? null
      : null,
};

const registerTestIpc = (): void => {
  ipcMain.handle(IPC.TestGetBootstrap, (): TestBootstrap => TEST_BOOTSTRAP);
};

// Prevent unhandled rejections from silently killing the main process.
// chokidar callbacks, IPC handlers, and file I/O all run async — a
// rejected promise with no .catch() would otherwise crash with no trace.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason);
});

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
  });

  // Detect renderer process crashes so they aren't completely silent.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] renderer crashed:', details.reason, details.exitCode);
  });

  win.on('unresponsive', () => {
    console.error('[main] renderer became unresponsive');
  });

  // Renderer reloads (Ctrl+R, devtools reload, HMR full reload) tear down
  // every React component without giving them a chance to run their effect
  // cleanups. The pty Map in src/main/ipc/terminal.ts lives in the main
  // process, so any ptys spawned by the previous renderer survive — they
  // pile up until createTerminal hits MAX_TERMINALS and the next attempt
  // fails. Killing them on `did-start-navigation` ties pty lifetime to
  // the renderer that owns them.
  win.webContents.on('did-start-navigation', (_e, _url, isInPlace, isMainFrame) => {
    if (!isMainFrame || isInPlace) return;
    disposeAllTerminals();
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  initWatcher(win);
};

// Register a custom protocol that serves project asset files. The renderer
// uses `scamp-asset://<absolute-path>` URLs for `<img>` elements so they
// resolve correctly regardless of the dev-server or production origin.
protocol.registerSchemesAsPrivileged([
  { scheme: 'scamp-asset', privileges: { standard: true, bypassCSP: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';

  // Grant `local-fonts` so the renderer can call
  // `window.queryLocalFonts()` and enumerate the user's installed
  // fonts. Scamp loads its own local content — there's no
  // third-party origin to worry about.
  //
  // Electron's TS types predate the Chromium permission, so we widen
  // to string for the comparison.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    if ((permission as string) === 'local-fonts') return cb(true);
    cb(false);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if ((permission as string) === 'local-fonts') return true;
    return false;
  });

  protocol.handle('scamp-asset', (request) => {
    // URL form: `scamp-asset://localhost/<encoded-absolute-path>`
    // Parse with URL to get a correctly decoded pathname.
    const parsed = new URL(request.url);
    const filePath = decodeURIComponent(parsed.pathname);
    return net.fetch(`file://${filePath}`);
  });

  registerProjectIpc();
  registerFileIpc();
  registerPageIpc();
  registerRecentProjectsIpc();
  registerSettingsIpc();
  registerProjectConfigIpc();
  registerTerminalIpc();
  registerThemeIpc();
  registerImageIpc();
  registerTestIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  disposeWatcher();
  disposeAllTerminals();
  if (process.platform !== 'darwin') app.quit();
});
