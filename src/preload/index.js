import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipcChannels';
/**
 * Minimal API surface exposed to the renderer. Keep this small — every
 * function here is a potential attack surface and a contract that must
 * stay stable.
 */
const api = {
    chooseFolder: () => ipcRenderer.invoke(IPC.ProjectChooseFolder),
    createProject: (args) => ipcRenderer.invoke(IPC.ProjectCreate, args),
    openProject: (args) => ipcRenderer.invoke(IPC.ProjectOpen, args),
    readProject: (args) => ipcRenderer.invoke(IPC.ProjectRead, args),
    migrateProject: (args) => ipcRenderer.invoke(IPC.ProjectMigrate, args),
    /**
     * Open (or focus + navigate) the preview window for the project.
     * Returns the window id so callers can correlate; main spawns the
     * dev server in parallel as the window opens.
     */
    openPreview: (args) => ipcRenderer.invoke(IPC.PreviewOpen, args),
    /**
     * Push an updated active page + page list to an already-open
     * preview window. No-op if no preview is open for the project
     * (won't spawn one). Used so the URL-bar dropdown stays accurate
     * when the user adds / renames / deletes a page in the canvas.
     */
    updatePreview: (args) => ipcRenderer.invoke(IPC.PreviewUpdate, args),
    /**
     * Close the preview window AND stop its dev server for a project.
     * Called when the user closes the project — preview shouldn't
     * outlive the project that's editing it.
     */
    closePreview: (projectPath) => ipcRenderer.invoke(IPC.PreviewClose, { projectPath }),
    writeFile: (args) => ipcRenderer.invoke(IPC.FileWrite, args),
    patchFile: (args) => ipcRenderer.invoke(IPC.FilePatch, args),
    createPage: (args) => ipcRenderer.invoke(IPC.PageCreate, args),
    deletePage: (args) => ipcRenderer.invoke(IPC.PageDelete, args),
    duplicatePage: (args) => ipcRenderer.invoke(IPC.PageDuplicate, args),
    renamePage: (args) => ipcRenderer.invoke(IPC.PageRename, args),
    createComponent: (args) => ipcRenderer.invoke(IPC.ComponentCreate, args),
    deleteComponent: (args) => ipcRenderer.invoke(IPC.ComponentDelete, args),
    readComponent: (args) => ipcRenderer.invoke(IPC.ComponentRead, args),
    writeComponentThumbnail: (args) => ipcRenderer.invoke(IPC.ComponentWriteThumbnail, args),
    readComponentThumbnail: (args) => ipcRenderer.invoke(IPC.ComponentReadThumbnail, args),
    // Project snapshots (persistent `.scamp/` point-in-time copies).
    createSnapshot: (args) => ipcRenderer.invoke(IPC.SnapshotCreate, args),
    listSnapshots: (args) => ipcRenderer.invoke(IPC.SnapshotList, args),
    restoreSnapshot: (args) => ipcRenderer.invoke(IPC.SnapshotRestore, args),
    deleteSnapshot: (args) => ipcRenderer.invoke(IPC.SnapshotDelete, args),
    readSnapshotPage: (args) => ipcRenderer.invoke(IPC.SnapshotReadPage, args),
    /**
     * Every project in the default folder, merged with recently-opened
     * projects (deduped, most-recent first). See IPC.ProjectsList.
     */
    getStartScreenProjects: () => ipcRenderer.invoke(IPC.ProjectsList),
    removeRecentProject: (path) => ipcRenderer.invoke(IPC.RecentProjectsRemove, { path }),
    // Settings
    getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
    setDefaultProjectsFolder: (path) => ipcRenderer.invoke(IPC.SettingsSetDefaultFolder, { path }),
    updateSettings: (patch) => ipcRenderer.invoke(IPC.SettingsUpdate, patch),
    /** Trigger the main process to (re-)initialise or shut down Sentry
     *  in response to the Privacy toggle changing or the first-launch
     *  opt-in prompt being answered. */
    reinitSentry: (optedIn) => ipcRenderer.invoke(IPC.AppReinitSentry, optedIn),
    /** The Scamp app version (from package.json) — useful in any
     *  diagnostic UI that wants to surface it. */
    getAppVersion: () => ipcRenderer.invoke(IPC.AppGetVersion),
    readProjectConfig: (args) => ipcRenderer.invoke(IPC.ProjectConfigRead, args),
    writeProjectConfig: (args) => ipcRenderer.invoke(IPC.ProjectConfigWrite, args),
    onFileChanged: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.FileChanged, listener);
        return () => ipcRenderer.removeListener(IPC.FileChanged, listener);
    },
    onProjectPagesChanged: (handler) => {
        const listener = () => handler();
        ipcRenderer.on(IPC.ProjectPagesChanged, listener);
        return () => ipcRenderer.removeListener(IPC.ProjectPagesChanged, listener);
    },
    onFileWriteAck: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.FileWriteAck, listener);
        return () => ipcRenderer.removeListener(IPC.FileWriteAck, listener);
    },
    // Clipboard (paste from OS)
    readClipboard: () => ipcRenderer.invoke(IPC.ClipboardRead),
    saveClipboardImage: (args) => ipcRenderer.invoke(IPC.ClipboardSaveImage, args),
    // Images
    copyImage: (args) => ipcRenderer.invoke(IPC.FileCopyImage, args),
    chooseImage: (args) => ipcRenderer.invoke(IPC.FileChooseImage, args),
    // Export (page or element)
    exportChooseSavePath: (args) => ipcRenderer.invoke(IPC.ExportChooseSavePath, args),
    exportPng: (args) => ipcRenderer.invoke(IPC.ExportPng, args),
    exportSvg: (args) => ipcRenderer.invoke(IPC.ExportSvg, args),
    // Theme
    readTheme: (args) => ipcRenderer.invoke(IPC.ThemeRead, args),
    writeTheme: (args) => ipcRenderer.invoke(IPC.ThemeWrite, args),
    onThemeChanged: (handler) => {
        const listener = (_e, content) => handler(content);
        ipcRenderer.on(IPC.ThemeChanged, listener);
        return () => ipcRenderer.removeListener(IPC.ThemeChanged, listener);
    },
    // Terminal
    createTerminal: (args) => ipcRenderer.invoke(IPC.TerminalCreate, args),
    writeTerminal: (args) => ipcRenderer.invoke(IPC.TerminalWrite, args),
    resizeTerminal: (args) => ipcRenderer.invoke(IPC.TerminalResize, args),
    killTerminal: (args) => ipcRenderer.invoke(IPC.TerminalKill, args),
    onTerminalData: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.TerminalData, listener);
        return () => ipcRenderer.removeListener(IPC.TerminalData, listener);
    },
    onTerminalExit: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.TerminalExit, listener);
        return () => ipcRenderer.removeListener(IPC.TerminalExit, listener);
    },
    onTerminalForegroundProcess: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.TerminalForegroundProcess, listener);
        return () => ipcRenderer.removeListener(IPC.TerminalForegroundProcess, listener);
    },
    // Auto-update. The renderer subscribes to status events to drive the
    // update banner; `installUpdateNow` triggers quit-and-install.
    installUpdateNow: () => ipcRenderer.invoke(IPC.UpdaterInstallNow),
    onUpdaterAvailable: (handler) => {
        const listener = (_e, info) => handler(info);
        ipcRenderer.on(IPC.UpdaterAvailable, listener);
        return () => ipcRenderer.removeListener(IPC.UpdaterAvailable, listener);
    },
    onUpdaterProgress: (handler) => {
        const listener = (_e, progress) => handler(progress);
        ipcRenderer.on(IPC.UpdaterProgress, listener);
        return () => ipcRenderer.removeListener(IPC.UpdaterProgress, listener);
    },
    onUpdaterDownloaded: (handler) => {
        const listener = (_e, info) => handler(info);
        ipcRenderer.on(IPC.UpdaterDownloaded, listener);
        return () => ipcRenderer.removeListener(IPC.UpdaterDownloaded, listener);
    },
    onUpdaterError: (handler) => {
        const listener = (_e, message) => handler(message);
        ipcRenderer.on(IPC.UpdaterError, listener);
        return () => ipcRenderer.removeListener(IPC.UpdaterError, listener);
    },
    // E2E test bootstrap. Returns { e2e: false, autoOpenProjectPath: null }
    // in normal use; only populated when the main process was launched
    // with SCAMP_E2E=1.
    getTestBootstrap: () => ipcRenderer.invoke(IPC.TestGetBootstrap),
};
contextBridge.exposeInMainWorld('scamp', api);
