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
    getRecentProjects: () => ipcRenderer.invoke(IPC.RecentProjectsGet),
    removeRecentProject: (path) => ipcRenderer.invoke(IPC.RecentProjectsRemove, { path }),
    // Settings
    getSettings: () => ipcRenderer.invoke(IPC.SettingsGet),
    setDefaultProjectsFolder: (path) => ipcRenderer.invoke(IPC.SettingsSetDefaultFolder, { path }),
    updateSettings: (patch) => ipcRenderer.invoke(IPC.SettingsUpdate, patch),
    readProjectConfig: (args) => ipcRenderer.invoke(IPC.ProjectConfigRead, args),
    writeProjectConfig: (args) => ipcRenderer.invoke(IPC.ProjectConfigWrite, args),
    onFileChanged: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.FileChanged, listener);
        return () => ipcRenderer.removeListener(IPC.FileChanged, listener);
    },
    onFileWriteAck: (handler) => {
        const listener = (_e, payload) => handler(payload);
        ipcRenderer.on(IPC.FileWriteAck, listener);
        return () => ipcRenderer.removeListener(IPC.FileWriteAck, listener);
    },
    // Images
    copyImage: (args) => ipcRenderer.invoke(IPC.FileCopyImage, args),
    chooseImage: (args) => ipcRenderer.invoke(IPC.FileChooseImage, args),
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
    // E2E test bootstrap. Returns { e2e: false, autoOpenProjectPath: null }
    // in normal use; only populated when the main process was launched
    // with SCAMP_E2E=1.
    getTestBootstrap: () => ipcRenderer.invoke(IPC.TestGetBootstrap),
};
contextBridge.exposeInMainWorld('scamp', api);
