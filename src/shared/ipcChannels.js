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
    // Recent projects
    RecentProjectsGet: 'recentProjects:get',
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
    FileChooseImage: 'file:chooseImage',
    // Theme
    ThemeRead: 'theme:read',
    ThemeChanged: 'theme:changed',
    ThemeWrite: 'theme:write',
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
    SnapshotRestore: 'snapshot:restore',
    // Main → renderer: the restore's file copies have landed, so the
    // renderer can refresh the project + clear the in-session undo stack.
    SnapshotRestoreComplete: 'snapshot:restore:complete',
    SnapshotDelete: 'snapshot:delete',
    // Export (page or element)
    ExportChooseSavePath: 'export:chooseSavePath',
    ExportPng: 'export:png',
    ExportSvg: 'export:svg',
    // E2E test bootstrap (only live when SCAMP_E2E=1)
    TestGetBootstrap: 'test:getBootstrap',
};
