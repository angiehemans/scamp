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
  ProjectMigrate: 'project:migrate',
  // Fired by the file watcher when a page-file appears or
  // disappears externally (agent / editor / file manager).
  // The renderer reacts by re-reading the project's pages
  // list so the page navigator reflects on-disk reality.
  ProjectPagesChanged: 'project:pagesChanged',

  // File operations
  FileWrite: 'file:write',
  FilePatch: 'file:patch',
  FileChanged: 'file:changed',
  FileWriteAck: 'file:writeAck',

  // Page operations
  PageCreate: 'page:create',
  PageDelete: 'page:delete',
  PageDuplicate: 'page:duplicate',
  PageRename: 'page:rename',

  // Component operations — reusable component definitions in
  // `components/<Name>/<Name>.tsx` + `.module.css`. Mirror of the
  // page operations above. Nextjs-format projects only.
  ComponentCreate: 'component:create',
  ComponentDelete: 'component:delete',
  ComponentRead: 'component:read',
  // Thumbnail capture for the sidebar preview. Written under
  // `.scamp/component-thumbs/<Name>.png` inside the project so it
  // stays local-only (the scaffolded `.gitignore` ignores `.scamp/`).
  ComponentWriteThumbnail: 'component:writeThumbnail',
  ComponentReadThumbnail: 'component:readThumbnail',

  // Live agent context — a markdown snapshot of the open target and the
  // selected element, written to `.scamp/context.md` on every selection so
  // an agent in the terminal can read it instead of asking the user what
  // they clicked. Fire-and-forget: never blocks a canvas update.
  // see docs/plans/live-context-file-plan.md
  ContextWrite: 'context:write',

  // Start Screen project list — the union of the recent-opens store and
  // a scan of the default projects folder (deduped, sorted recent-first),
  // so every project in the folder shows, not just the last few opened.
  ProjectsList: 'projects:list',
  RecentProjectsRemove: 'recentProjects:remove',

  // App settings
  SettingsGet: 'settings:get',
  SettingsSetDefaultFolder: 'settings:setDefaultFolder',
  SettingsUpdate: 'settings:update',

  // Sentry crash reporting — invoked when the Privacy toggle or
  // the first-launch opt-in prompt changes the user's choice. The
  // main process re-runs initSentryIfOptedIn / closeSentry so
  // the change takes effect this session, no restart required.
  AppReinitSentry: 'app:reinitSentry',
  AppGetVersion: 'app:getVersion',

  // Per-project config (scamp.config.json)
  ProjectConfigRead: 'projectConfig:read',
  ProjectConfigWrite: 'projectConfig:write',

  // Images
  FileCopyImage: 'file:copyImage',
  // Main → renderer: an imported image finished converting in the
  // background, so whatever referenced the original should now point at
  // the .webp. see docs/plans/image-import-speed-plan.md
  ImageOptimized: 'image:optimized',
  // Renderer → main: whether that swap actually landed. Main only
  // deletes the loser once it knows which file is referenced — a delete
  // on a wrong guess leaves a broken image in the user's project.
  ImageOptimizedApplied: 'image:optimizedApplied',
  FileChooseImage: 'file:chooseImage',
  // Read a file's UTF-8 text (used to inline imported SVGs + reload them).
  FileReadText: 'file:readText',
  // Main → renderer: an imported SVG's asset file changed on disk.
  SvgAssetChanged: 'svg:assetChanged',

  // Clipboard (paste from OS)
  ClipboardRead: 'clipboard:read',
  // Plain-text write. Used by "Copy context", which puts a one-line
  // description of the selection on the clipboard for pasting in front of a
  // terminal prompt. see docs/plans/copy-context-button-plan.md
  ClipboardWrite: 'clipboard:write',
  ClipboardSaveImage: 'clipboard:saveImage',

  // Theme
  ThemeRead: 'theme:read',
  ThemeChanged: 'theme:changed',
  ThemeWrite: 'theme:write',

  // Window chrome — recolor the native title-bar overlay on theme change.
  WindowSetTitleBarOverlay: 'window:setTitleBarOverlay',

  // DESIGN.md (design-system documentation, project root)
  DesignMdRead: 'designMd:read',
  DesignMdWrite: 'designMd:write',
  DesignMdChanged: 'designMd:changed',

  // Preview mode
  PreviewOpen: 'preview:open',
  PreviewStop: 'preview:stop',
  PreviewClose: 'preview:close',
  PreviewGetStatus: 'preview:getStatus',
  PreviewStatusChanged: 'preview:statusChanged',
  PreviewNavigate: 'preview:navigate',
  /**
   * Renderer → main: push an updated page list / active page to an
   * already-open preview window. No-op when no preview is open for
   * the project (won't spawn one). Used so the dropdown stays
   * accurate when the user creates / renames / deletes a page in the
   * canvas while preview is open.
   */
  PreviewUpdate: 'preview:update',
  PreviewRestart: 'preview:restart',

  // Terminal (renderer ↔ main)
  TerminalCreate: 'terminal:create',
  TerminalWrite: 'terminal:write',
  TerminalResize: 'terminal:resize',
  TerminalKill: 'terminal:kill',
  TerminalData: 'terminal:data',
  TerminalExit: 'terminal:exit',
  // Phase 4: foreground-process change for a pty. Fired by the
  // main-side poller when the pty's foreground command transitions
  // between the user's shell (idle prompt) and a child process
  // (agent activity). The renderer uses this to flip the sync
  // engine into pause + show the appropriate status pill.
  TerminalForegroundProcess: 'terminal:foregroundProcess',

  // Project snapshots — persistent point-in-time copies of all page +
  // component files, stored under `.scamp/snapshots/`. All file I/O
  // happens main-side; see docs/notes/snapshots.md.
  SnapshotCreate: 'snapshot:create',
  SnapshotList: 'snapshot:list',
  // Restore broadcasts the existing ProjectPagesChanged afterwards (its
  // file copies are suppressed at the watcher) to drive a full renderer
  // re-read, so it needs no dedicated completion channel.
  SnapshotRestore: 'snapshot:restore',
  SnapshotDelete: 'snapshot:delete',
  // Read one page's files from a snapshot without restoring — the
  // read-only preview shows the snapshot on the canvas before committing.
  SnapshotReadPage: 'snapshot:read-page',

  // Export (page or element)
  ExportChooseSavePath: 'export:chooseSavePath',
  ExportPng: 'export:png',
  ExportSvg: 'export:svg',

  // Auto-update (electron-updater). Main → renderer status events drive
  // the in-app update banner; the renderer → main install trigger fires
  // when the user clicks "Restart and install". See docs/notes/auto-update.md.
  UpdaterChecking: 'updater:checking',
  UpdaterAvailable: 'updater:available',
  UpdaterNotAvailable: 'updater:not-available',
  UpdaterProgress: 'updater:progress',
  UpdaterDownloaded: 'updater:downloaded',
  UpdaterError: 'updater:error',
  UpdaterInstallNow: 'updater:install-now',

  // MCP server (main) → renderer canvas query, and the reply back.
  // Pull-through rather than a cached snapshot in main: an agent asking
  // "what is selected" right after the user clicked must not be told about
  // the previous selection. See docs/plans/mcp-server-plan.md.
  McpQuery: 'mcp:query',
  McpQueryResult: 'mcp:query-result',
  // Renderer asks whether the server is up, for the terminal indicator.
  McpStatus: 'mcp:status',

  // E2E test bootstrap (only live when SCAMP_E2E=1)
  TestGetBootstrap: 'test:getBootstrap',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
