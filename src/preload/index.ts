import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type {
  ChooseFolderResult,
  CreateProjectArgs,
  FileChangedPayload,
  FilePatchArgs,
  FileWriteArgs,
  OpenProjectArgs,
  PageCreateArgs,
  PageDeleteArgs,
  PageFile,
  ProjectData,
  RecentProject,
  Settings,
  TerminalCreateArgs,
  TerminalCreateResult,
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalKillArgs,
  TerminalResizeArgs,
  TerminalWriteArgs,
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

  writeFile: (args: FileWriteArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.FileWrite, args),

  patchFile: (args: FilePatchArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.FilePatch, args),

  createPage: (args: PageCreateArgs): Promise<PageFile> =>
    ipcRenderer.invoke(IPC.PageCreate, args),

  deletePage: (args: PageDeleteArgs): Promise<void> =>
    ipcRenderer.invoke(IPC.PageDelete, args),

  getRecentProjects: (): Promise<Array<RecentProject & { exists: boolean }>> =>
    ipcRenderer.invoke(IPC.RecentProjectsGet),

  removeRecentProject: (path: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RecentProjectsRemove, { path }),

  // Settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.SettingsGet),

  setDefaultProjectsFolder: (path: string | null): Promise<Settings> =>
    ipcRenderer.invoke(IPC.SettingsSetDefaultFolder, { path }),

  onFileChanged: (handler: (payload: FileChangedPayload) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: FileChangedPayload): void => handler(payload);
    ipcRenderer.on(IPC.FileChanged, listener);
    return () => ipcRenderer.removeListener(IPC.FileChanged, listener);
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
};

contextBridge.exposeInMainWorld('scamp', api);

export type ScampApi = typeof api;
