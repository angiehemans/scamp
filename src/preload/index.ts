import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  ChooseFolderResult,
  ChooseImageArgs,
  ChooseImageResult,
  CopyImageArgs,
  CopyImageResult,
  CreateProjectArgs,
  ExportChooseSavePathArgs,
  ExportChooseSavePathResult,
  ExportPngArgs,
  ExportResult,
  ExportSvgArgs,
  FileChangedPayload,
  FilePatchArgs,
  FilePatchResult,
  FileWriteAckPayload,
  FileWriteArgs,
  FileWriteResult,
  OpenProjectArgs,
  ComponentCreateArgs,
  ComponentDeleteArgs,
  ComponentFile,
  ComponentReadArgs,
  ComponentReadThumbnailArgs,
  ComponentReadThumbnailResult,
  ComponentWriteThumbnailArgs,
  ComponentWriteThumbnailResult,
  PageCreateArgs,
  PageDeleteArgs,
  PageDuplicateArgs,
  PageFile,
  PageRenameArgs,
  ProjectConfig,
  ProjectConfigReadArgs,
  ProjectConfigWriteArgs,
  ProjectData,
  PreviewOpenArgs,
  ProjectMigrateArgs,
  ProjectMigrateResult,
  Settings,
  SnapshotCreateArgs,
  SnapshotCreateResult,
  SnapshotDeleteArgs,
  SnapshotDeleteResult,
  SnapshotListArgs,
  SnapshotListResult,
  SnapshotReadPageArgs,
  SnapshotReadPageResult,
  SnapshotRestoreArgs,
  SnapshotRestoreResult,
  StartScreenProject,
  TerminalCreateArgs,
  TerminalCreateResult,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalForegroundProcessPayload,
  TerminalKillArgs,
  TerminalResizeArgs,
  TerminalWriteArgs,
  TestBootstrap,
  UpdaterInfoPayload,
  UpdaterProgressPayload,
} from '@shared/types';

/**
 * Minimal API surface exposed to the renderer. Keep this small — every
 * function here is a potential attack surface and a contract that must
 * stay stable.
 */
const api = {
  chooseFolder: (): Promise<ChooseFolderResult> =>
    ipcRenderer.invoke(IPC.ProjectChooseFolder),

  createProject: (args: CreateProjectArgs): Promise<ProjectData> =>
    ipcRenderer.invoke(IPC.ProjectCreate, args),

  openProject: (args: OpenProjectArgs): Promise<ProjectData> =>
    ipcRenderer.invoke(IPC.ProjectOpen, args),

  readProject: (args: OpenProjectArgs): Promise<ProjectData> =>
    ipcRenderer.invoke(IPC.ProjectRead, args),

  migrateProject: (args: ProjectMigrateArgs): Promise<ProjectMigrateResult> =>
    ipcRenderer.invoke(IPC.ProjectMigrate, args),

  /**
   * Open (or focus + navigate) the preview window for the project.
   * Returns the window id so callers can correlate; main spawns the
   * dev server in parallel as the window opens.
   */
  openPreview: (args: PreviewOpenArgs): Promise<{ windowId: number }> =>
    ipcRenderer.invoke(IPC.PreviewOpen, args),

  /**
   * Push an updated active page + page list to an already-open
   * preview window. No-op if no preview is open for the project
   * (won't spawn one). Used so the URL-bar dropdown stays accurate
   * when the user adds / renames / deletes a page in the canvas.
   */
  updatePreview: (args: PreviewOpenArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.PreviewUpdate, args),

  /**
   * Close the preview window AND stop its dev server for a project.
   * Called when the user closes the project — preview shouldn't
   * outlive the project that's editing it.
   */
  closePreview: (projectPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.PreviewClose, { projectPath }),

  writeFile: (args: FileWriteArgs): Promise<FileWriteResult> =>
    ipcRenderer.invoke(IPC.FileWrite, args),

  patchFile: (args: FilePatchArgs): Promise<FilePatchResult> =>
    ipcRenderer.invoke(IPC.FilePatch, args),

  createPage: (args: PageCreateArgs): Promise<PageFile> =>
    ipcRenderer.invoke(IPC.PageCreate, args),

  deletePage: (args: PageDeleteArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.PageDelete, args),

  duplicatePage: (args: PageDuplicateArgs): Promise<PageFile> =>
    ipcRenderer.invoke(IPC.PageDuplicate, args),

  renamePage: (args: PageRenameArgs): Promise<PageFile> =>
    ipcRenderer.invoke(IPC.PageRename, args),

  createComponent: (args: ComponentCreateArgs): Promise<ComponentFile> =>
    ipcRenderer.invoke(IPC.ComponentCreate, args),

  deleteComponent: (args: ComponentDeleteArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.ComponentDelete, args),

  readComponent: (args: ComponentReadArgs): Promise<ComponentFile | null> =>
    ipcRenderer.invoke(IPC.ComponentRead, args),

  writeComponentThumbnail: (
    args: ComponentWriteThumbnailArgs
  ): Promise<ComponentWriteThumbnailResult> =>
    ipcRenderer.invoke(IPC.ComponentWriteThumbnail, args),

  readComponentThumbnail: (
    args: ComponentReadThumbnailArgs
  ): Promise<ComponentReadThumbnailResult> =>
    ipcRenderer.invoke(IPC.ComponentReadThumbnail, args),

  // Project snapshots (persistent `.scamp/` point-in-time copies).
  createSnapshot: (
    args: SnapshotCreateArgs
  ): Promise<SnapshotCreateResult> =>
    ipcRenderer.invoke(IPC.SnapshotCreate, args),

  listSnapshots: (args: SnapshotListArgs): Promise<SnapshotListResult> =>
    ipcRenderer.invoke(IPC.SnapshotList, args),

  restoreSnapshot: (
    args: SnapshotRestoreArgs
  ): Promise<SnapshotRestoreResult> =>
    ipcRenderer.invoke(IPC.SnapshotRestore, args),

  deleteSnapshot: (
    args: SnapshotDeleteArgs
  ): Promise<SnapshotDeleteResult> =>
    ipcRenderer.invoke(IPC.SnapshotDelete, args),

  readSnapshotPage: (
    args: SnapshotReadPageArgs
  ): Promise<SnapshotReadPageResult> =>
    ipcRenderer.invoke(IPC.SnapshotReadPage, args),

  /**
   * Every project in the default folder, merged with recently-opened
   * projects (deduped, most-recent first). See IPC.ProjectsList.
   */
  getStartScreenProjects: (): Promise<StartScreenProject[]> =>
    ipcRenderer.invoke(IPC.ProjectsList),

  removeRecentProject: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RecentProjectsRemove, { path }),

  // Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),

  setDefaultProjectsFolder: (path: string | null): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsSetDefaultFolder, { path }),

  updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsUpdate, patch),

  /** Trigger the main process to (re-)initialise or shut down Sentry
   *  in response to the Privacy toggle changing or the first-launch
   *  opt-in prompt being answered. */
  reinitSentry: (optedIn: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.AppReinitSentry, optedIn),

  /** The Scamp app version (from package.json) — useful in any
   *  diagnostic UI that wants to surface it. */
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC.AppGetVersion),

  readProjectConfig: (args: ProjectConfigReadArgs): Promise<ProjectConfig> =>
    ipcRenderer.invoke(IPC.ProjectConfigRead, args),

  writeProjectConfig: (args: ProjectConfigWriteArgs): Promise<ProjectConfig> =>
    ipcRenderer.invoke(IPC.ProjectConfigWrite, args),

  onFileChanged: (handler: (payload: FileChangedPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: FileChangedPayload): void => handler(payload);
    ipcRenderer.on(IPC.FileChanged, listener);
    return () => ipcRenderer.removeListener(IPC.FileChanged, listener);
  },

  onProjectPagesChanged: (handler: () => void): (() => void) => {
    const listener = (): void => handler();
    ipcRenderer.on(IPC.ProjectPagesChanged, listener);
    return () => ipcRenderer.removeListener(IPC.ProjectPagesChanged, listener);
  },

  onFileWriteAck: (handler: (payload: FileWriteAckPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: FileWriteAckPayload): void => handler(payload);
    ipcRenderer.on(IPC.FileWriteAck, listener);
    return () => ipcRenderer.removeListener(IPC.FileWriteAck, listener);
  },

  // Images
  copyImage: (args: CopyImageArgs): Promise<CopyImageResult> =>
    ipcRenderer.invoke(IPC.FileCopyImage, args),

  chooseImage: (args?: ChooseImageArgs): Promise<ChooseImageResult> =>
    ipcRenderer.invoke(IPC.FileChooseImage, args),

  // Export (page or element)
  exportChooseSavePath: (
    args: ExportChooseSavePathArgs
  ): Promise<ExportChooseSavePathResult> =>
    ipcRenderer.invoke(IPC.ExportChooseSavePath, args),

  exportPng: (args: ExportPngArgs): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC.ExportPng, args),

  exportSvg: (args: ExportSvgArgs): Promise<ExportResult> =>
    ipcRenderer.invoke(IPC.ExportSvg, args),

  // Theme
  readTheme: (args: { projectPath: string }): Promise<string> =>
    ipcRenderer.invoke(IPC.ThemeRead, args),

  writeTheme: (args: { projectPath: string; content: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.ThemeWrite, args),

  onThemeChanged: (handler: (content: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, content: string): void => handler(content);
    ipcRenderer.on(IPC.ThemeChanged, listener);
    return () => ipcRenderer.removeListener(IPC.ThemeChanged, listener);
  },

  // Terminal
  createTerminal: (args: TerminalCreateArgs): Promise<TerminalCreateResult> =>
    ipcRenderer.invoke(IPC.TerminalCreate, args),

  writeTerminal: (args: TerminalWriteArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.TerminalWrite, args),

  resizeTerminal: (args: TerminalResizeArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.TerminalResize, args),

  killTerminal: (args: TerminalKillArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.TerminalKill, args),

  onTerminalData: (handler: (payload: TerminalDataPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: TerminalDataPayload): void => handler(payload);
    ipcRenderer.on(IPC.TerminalData, listener);
    return () => ipcRenderer.removeListener(IPC.TerminalData, listener);
  },

  onTerminalExit: (handler: (payload: TerminalExitPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: TerminalExitPayload): void => handler(payload);
    ipcRenderer.on(IPC.TerminalExit, listener);
    return () => ipcRenderer.removeListener(IPC.TerminalExit, listener);
  },

  onTerminalForegroundProcess: (
    handler: (payload: TerminalForegroundProcessPayload) => void
  ): (() => void) => {
    const listener = (
      _e: IpcRendererEvent,
      payload: TerminalForegroundProcessPayload
    ): void => handler(payload);
    ipcRenderer.on(IPC.TerminalForegroundProcess, listener);
    return () =>
      ipcRenderer.removeListener(IPC.TerminalForegroundProcess, listener);
  },

  // Auto-update. The renderer subscribes to status events to drive the
  // update banner; `installUpdateNow` triggers quit-and-install.
  installUpdateNow: (): Promise<void> =>
    ipcRenderer.invoke(IPC.UpdaterInstallNow),

  onUpdaterAvailable: (
    handler: (info: UpdaterInfoPayload) => void
  ): (() => void) => {
    const listener = (_e: IpcRendererEvent, info: UpdaterInfoPayload): void =>
      handler(info);
    ipcRenderer.on(IPC.UpdaterAvailable, listener);
    return () => ipcRenderer.removeListener(IPC.UpdaterAvailable, listener);
  },

  onUpdaterProgress: (
    handler: (progress: UpdaterProgressPayload) => void
  ): (() => void) => {
    const listener = (
      _e: IpcRendererEvent,
      progress: UpdaterProgressPayload
    ): void => handler(progress);
    ipcRenderer.on(IPC.UpdaterProgress, listener);
    return () => ipcRenderer.removeListener(IPC.UpdaterProgress, listener);
  },

  onUpdaterDownloaded: (
    handler: (info: UpdaterInfoPayload) => void
  ): (() => void) => {
    const listener = (_e: IpcRendererEvent, info: UpdaterInfoPayload): void =>
      handler(info);
    ipcRenderer.on(IPC.UpdaterDownloaded, listener);
    return () => ipcRenderer.removeListener(IPC.UpdaterDownloaded, listener);
  },

  onUpdaterError: (handler: (message: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, message: string): void =>
      handler(message);
    ipcRenderer.on(IPC.UpdaterError, listener);
    return () => ipcRenderer.removeListener(IPC.UpdaterError, listener);
  },

  // E2E test bootstrap. Returns { e2e: false, autoOpenProjectPath: null }
  // in normal use; only populated when the main process was launched
  // with SCAMP_E2E=1.
  getTestBootstrap: (): Promise<TestBootstrap> =>
    ipcRenderer.invoke(IPC.TestGetBootstrap),
};

contextBridge.exposeInMainWorld('scamp', api);

export type ScampApi = typeof api;
