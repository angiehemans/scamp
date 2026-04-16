/**
 * Centralized IPC channel name constants. Never hardcode channel name strings —
 * always import from here so renaming is safe and the surface stays small.
 */
export const IPC = {
  // Project lifecycle
  ProjectChooseFolder: 'project:chooseFolder',
  ProjectCreate: 'project:create',
  ProjectOpen: 'project:open',
  ProjectRead: 'project:read',

  // File operations
  FileWrite: 'file:write',
  FilePatch: 'file:patch',
  FileChanged: 'file:changed',

  // Page operations
  PageCreate: 'page:create',
  PageDelete: 'page:delete',
  PageDuplicate: 'page:duplicate',
  PageRename: 'page:rename',

  // Recent projects
  RecentProjectsGet: 'recentProjects:get',
  RecentProjectsRemove: 'recentProjects:remove',

  // App settings
  SettingsGet: 'settings:get',
  SettingsSetDefaultFolder: 'settings:setDefaultFolder',
  SettingsUpdate: 'settings:update',

  // Per-project config (scamp.config.json)
  ProjectConfigRead: 'projectConfig:read',
  ProjectConfigWrite: 'projectConfig:write',

  // Images
  FileCopyImage: 'file:copyImage',
  FileChooseImage: 'file:chooseImage',

  // Theme
  ThemeRead: 'theme:read',
  ThemeChanged: 'theme:changed',
  ThemeWrite: 'theme:write',

  // Terminal (renderer ↔ main)
  TerminalCreate: 'terminal:create',
  TerminalWrite: 'terminal:write',
  TerminalResize: 'terminal:resize',
  TerminalKill: 'terminal:kill',
  TerminalData: 'terminal:data',
  TerminalExit: 'terminal:exit',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
