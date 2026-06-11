import { app, BrowserWindow, ipcMain, Menu, nativeTheme, net, protocol, session, shell } from 'electron';
import { join } from 'path';
import { IPC } from '@shared/ipcChannels';
import type { Settings, TestBootstrap } from '@shared/types';
import { registerProjectIpc } from './ipc/project';
import { registerFileIpc } from './ipc/file';
import { registerPageIpc } from './ipc/page';
import { registerComponentIpc } from './ipc/component';
import { registerRecentProjectsIpc } from './ipc/recentProjects';
import { registerSettingsIpc, readSettingsSync } from './ipc/settings';
import { registerProjectConfigIpc } from './ipc/projectConfig';
import { registerTerminalIpc, disposeAllTerminals } from './ipc/terminal';
import { registerThemeIpc } from './ipc/theme';
import { registerImageIpc } from './ipc/image';
import { registerExportIpc } from './ipc/export';
import { registerPreviewIpc } from './ipc/preview';
import {
  closeAllPreviewWindows,
  closePreviewWindow,
  openPreviewWindow,
  updatePreviewWindow,
} from './previewWindow';
import { stopAllDevServers } from './devServer/devServerManager';
import { initWatcher, disposeWatcher, getWatchedPath } from './watcher';
import { resolveInsideProject } from './ipc/pathContainment';
import {
  initSentryIfOptedIn,
  setSentryEnabled,
  setSentryProjectRoot,
} from './sentry';
import { buildApplicationMenu } from './menu';
import { fixPathFromLoginShell } from './fixPath';

const TEST_BOOTSTRAP: TestBootstrap = {
  e2e: process.env['SCAMP_E2E'] === '1',
  autoOpenProjectPath:
    process.env['SCAMP_E2E'] === '1'
      ? process.env['SCAMP_E2E_OPEN_PROJECT'] ?? null
      : null,
};

// Initialise Sentry at module load — BEFORE the `app.whenReady`
// promise can resolve. The SDK hooks into Electron's protocol /
// IPC layers, which Electron locks down once it fires its
// internal 'ready' event, so calling `Sentry.init` from inside
// `whenReady().then(...)` throws "Sentry SDK should be initialized
// before the Electron app 'ready' event is fired".
//
// `app.getPath('userData')` is one of the few Electron APIs that's
// available pre-ready, so the sync settings read here is safe. A
// fresh install reads `sentryOptIn: null` and the SDK init no-ops
// until the renderer's first-launch prompt writes a real choice
// — at which point the renderer fires the `app:reinitSentry` IPC
// (registered later inside `whenReady`) and the SDK comes up live.
const initialSettings = readSettingsSync();
initSentryIfOptedIn(initialSettings.sentryOptIn === true);

// GUI-launched packaged apps inherit a minimal PATH that omits
// Homebrew/nvm/etc, so spawning npm/node throws ENOENT. Resolve the
// login shell's real PATH once, before any child_process spawn.
// See docs/notes/packaged-path.md.
if (app.isPackaged) fixPathFromLoginShell();

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

/**
 * Path to the app icon. In dev `__dirname` points at the repo's
 * `out/main/` so we walk up to `src/renderer/src/assets/`. In a
 * packaged build the icon is bundled into the app's resources dir via
 * `extraResources` in `electron-builder.yml`.
 */
const iconPath = (): string =>
  app.isPackaged
    ? join(process.resourcesPath, 'scamp-icon.png')
    : join(__dirname, '../../src/renderer/src/assets/scamp-icon.png');

const createWindow = (): void => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath(),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // OS-level renderer isolation. Safe here because the main preload
      // (src/preload/index.ts) is a pure contextBridge/ipcRenderer bridge
      // with no direct Node usage — all privileged work happens in main.
      // See docs/notes/sandbox-tradeoffs.md.
      sandbox: true,
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
    // Fire-and-forget — we don't need to block navigation on the OS
    // actually reaping the old pty processes. The map is cleared
    // synchronously inside disposeAllTerminals, so the new renderer
    // sees an empty slot and can immediately spawn fresh ptys.
    void disposeAllTerminals();
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
  // Sentry init has already happened at module load — see the
  // pre-`whenReady` block above. Don't re-init here; the SDK
  // requires the very first call to be before 'ready' fires.

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
    // Assets live inside the open project (copyImage writes them there).
    // Contain the path to the active project root so a forged URL like
    // `scamp-asset://localhost/etc/passwd` can't exfiltrate arbitrary
    // files; serve a 404 instead.
    const projectRoot = getWatchedPath();
    if (projectRoot === null) {
      return new Response(null, { status: 404 });
    }
    let resolved: string;
    try {
      resolved = resolveInsideProject(filePath, projectRoot);
    } catch {
      return new Response(null, { status: 404 });
    }
    return net.fetch(`file://${resolved}`);
  });

  registerProjectIpc();
  registerFileIpc();
  registerPageIpc();
  registerComponentIpc();
  registerRecentProjectsIpc();
  registerSettingsIpc();
  registerProjectConfigIpc();
  registerTerminalIpc();
  registerThemeIpc();
  registerImageIpc();
  registerExportIpc();
  registerPreviewIpc({
    open: openPreviewWindow,
    close: closePreviewWindow,
    update: updatePreviewWindow,
  });
  registerTestIpc();

  // Sentry opt-in toggle — called from the renderer when the
  // Privacy switch (or the first-launch prompt) flips. The SDK
  // is already running from the module-load init; this just
  // toggles transmission, so no re-init is needed (and no
  // pre-ready check is hit).
  ipcMain.handle(IPC.AppReinitSentry, (_e, optedIn: boolean) => {
    setSentryEnabled(optedIn);
  });

  // Expose the app version to the renderer for diagnostic UI.
  // Reads from `package.json` via Electron at the main side; the
  // renderer can't read `app.getVersion()` directly through
  // contextIsolation.
  ipcMain.handle(IPC.AppGetVersion, (): string => app.getVersion());

  // Application menu — platform-standard entries (File / Edit /
  // View / Window) plus the Help → Report a bug submenu that
  // opens a pre-filled GitHub issue. Must register BEFORE the
  // first BrowserWindow so macOS picks up the app menu.
  Menu.setApplicationMenu(buildApplicationMenu());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/**
 * All shutdown work that must complete before the process actually
 * exits. Both `before-quit` and `window-all-closed` route through this.
 * Safe to call concurrently — disposeAllTerminals clears its map
 * synchronously and stopAllDevServers does the same.
 */
const performShutdownCleanup = async (): Promise<void> => {
  disposeWatcher();
  setSentryProjectRoot(null);
  closeAllPreviewWindows();
  await Promise.all([disposeAllTerminals(), stopAllDevServers()]);
};

// Note: when `app.quit()` (or Cmd+Q) initiates shutdown, Electron does
// NOT emit `window-all-closed` — it goes straight to before-quit →
// will-quit → quit. That's why the cleanup lives here: it's the only
// hook that runs reliably during a programmatic quit (e.g. Playwright
// teardown calling `electronApp.close()`).
let quitInitiated = false;
app.on('before-quit', (event) => {
  if (quitInitiated) return;
  event.preventDefault();
  quitInitiated = true;
  void performShutdownCleanup().finally(() => app.quit());
});

app.on('window-all-closed', () => {
  // Fires only when the user closes the last window directly (not via
  // app.quit()). On non-darwin we route through quit so the awaited
  // cleanup in before-quit runs. On darwin the app stays alive — kick
  // off cleanup anyway since there's no UI to reconnect orphaned ptys
  // and dev servers to.
  if (process.platform === 'darwin') {
    void performShutdownCleanup();
  } else {
    app.quit();
  }
});
