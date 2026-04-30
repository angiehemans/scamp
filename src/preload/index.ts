import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  ChooseFolderResult,
  ChooseImageArgs,
  ChooseImageResult,
  CopyImageArgs,
  CopyImageResult,
  CreateProjectArgs,
  FileChangedPayload,
  FilePatchArgs,
  FilePatchResult,
  FileWriteAckPayload,
  FileWriteArgs,
  FileWriteResult,
  OpenProjectArgs,
  PageCreateArgs,
  PageDeleteArgs,
  PageDuplicateArgs,
  PageFile,
  PageRenameArgs,
  ProjectConfig,
  ProjectConfigReadArgs,
  ProjectConfigWriteArgs,
  ProjectData,
  ProjectMigrateArgs,
  ProjectMigrateResult,
  RecentProject,
  Settings,
  TerminalCreateArgs,
  TerminalCreateResult,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalKillArgs,
  TerminalResizeArgs,
  TerminalWriteArgs,
  TestBootstrap,
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

  getRecentProjects: (): Promise<Array<RecentProject & { exists: boolean }>> =>
    ipcRenderer.invoke(IPC.RecentProjectsGet),

  removeRecentProject: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RecentProjectsRemove, { path }),

  // Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),

  setDefaultProjectsFolder: (path: string | null): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsSetDefaultFolder, { path }),

  updateSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsUpdate, patch),

  readProjectConfig: (args: ProjectConfigReadArgs): Promise<ProjectConfig> =>
    ipcRenderer.invoke(IPC.ProjectConfigRead, args),

  writeProjectConfig: (args: ProjectConfigWriteArgs): Promise<ProjectConfig> =>
    ipcRenderer.invoke(IPC.ProjectConfigWrite, args),

  onFileChanged: (handler: (payload: FileChangedPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: FileChangedPayload): void => handler(payload);
    ipcRenderer.on(IPC.FileChanged, listener);
    return () => ipcRenderer.removeListener(IPC.FileChanged, listener);
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

  // E2E test bootstrap. Returns { e2e: false, autoOpenProjectPath: null }
  // in normal use; only populated when the main process was launched
  // with SCAMP_E2E=1.
  getTestBootstrap: (): Promise<TestBootstrap> =>
    ipcRenderer.invoke(IPC.TestGetBootstrap),
};

contextBridge.exposeInMainWorld('scamp', api);

export type ScampApi = typeof api;
