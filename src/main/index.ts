import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import { join } from 'path';
import { registerProjectIpc } from './ipc/project';
import { registerFileIpc } from './ipc/file';
import { registerPageIpc } from './ipc/page';
import { registerRecentProjectsIpc } from './ipc/recentProjects';
import { registerSettingsIpc } from './ipc/settings';
import { registerTerminalIpc, disposeAllTerminals } from './ipc/terminal';
import { initWatcher, disposeWatcher } from './watcher';

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';

  registerProjectIpc();
  registerFileIpc();
  registerPageIpc();
  registerRecentProjectsIpc();
  registerSettingsIpc();
  registerTerminalIpc();

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
