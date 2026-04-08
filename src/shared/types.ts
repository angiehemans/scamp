/**
 * Shared types used by main, preload, and renderer.
 * All IPC payloads must have explicit types defined here.
 */

export type PageFile = {
  name: string;
  tsxPath: string;
  cssPath: string;
  tsxContent: string;
  cssContent: string;
};

export type ProjectData = {
  path: string;
  name: string;
  pages: PageFile[];
};

export type RecentProject = {
  name: string;
  path: string;
  lastOpened: string;
};

export type ChooseFolderResult = {
  canceled: boolean;
  path: string | null;
};

export type Settings = {
  /** The folder under which `New Project` creates project subdirectories. */
  defaultProjectsFolder: string | null;
};

export type CreateProjectArgs = {
  /** The directory in which to create the new project subfolder. */
  parentPath: string;
  /** The validated project name — used as both the folder name and display name. */
  name: string;
};

export type OpenProjectArgs = {
  folderPath: string;
};

export type FileWriteArgs = {
  tsxPath: string;
  cssPath: string;
  tsxContent: string;
  cssContent: string;
};

export type FilePatchArgs = {
  cssPath: string;
  className: string;
  newDeclarations: string;
};

export type FileChangedPayload = {
  path: string;
  tsxContent: string | null;
  cssContent: string | null;
};

export type PageCreateArgs = {
  projectPath: string;
  pageName: string;
};

export type PageDeleteArgs = {
  projectPath: string;
  pageName: string;
};

// Terminal IPC payloads
export type TerminalCreateArgs = {
  cwd: string;
  cols: number;
  rows: number;
};

export type TerminalCreateResult = {
  id: string;
};

export type TerminalWriteArgs = {
  id: string;
  data: string;
};

export type TerminalResizeArgs = {
  id: string;
  cols: number;
  rows: number;
};

export type TerminalKillArgs = {
  id: string;
};

export type TerminalDataPayload = {
  id: string;
  data: string;
};

export type TerminalExitPayload = {
  id: string;
  exitCode: number;
};
