/**
 * Centralized IPC channel name constants. Never hardcode channel name strings —
 * always import from here so renaming is safe and the surface stays small.
 */
export declare const IPC: {
    readonly ProjectChooseFolder: "project:chooseFolder";
    readonly ProjectCreate: "project:create";
    readonly ProjectOpen: "project:open";
    readonly ProjectRead: "project:read";
    readonly ProjectMigrate: "project:migrate";
    readonly ProjectPagesChanged: "project:pagesChanged";
    readonly FileWrite: "file:write";
    readonly FilePatch: "file:patch";
    readonly FileChanged: "file:changed";
    readonly FileWriteAck: "file:writeAck";
    readonly PageCreate: "page:create";
    readonly PageDelete: "page:delete";
    readonly PageDuplicate: "page:duplicate";
    readonly PageRename: "page:rename";
    readonly ComponentCreate: "component:create";
    readonly ComponentDelete: "component:delete";
    readonly ComponentRead: "component:read";
    readonly ComponentWriteThumbnail: "component:writeThumbnail";
    readonly ComponentReadThumbnail: "component:readThumbnail";
    readonly RecentProjectsGet: "recentProjects:get";
    readonly RecentProjectsRemove: "recentProjects:remove";
    readonly SettingsGet: "settings:get";
    readonly SettingsSetDefaultFolder: "settings:setDefaultFolder";
    readonly SettingsUpdate: "settings:update";
    readonly AppReinitSentry: "app:reinitSentry";
    readonly AppGetVersion: "app:getVersion";
    readonly ProjectConfigRead: "projectConfig:read";
    readonly ProjectConfigWrite: "projectConfig:write";
    readonly FileCopyImage: "file:copyImage";
    readonly FileChooseImage: "file:chooseImage";
    readonly ThemeRead: "theme:read";
    readonly ThemeChanged: "theme:changed";
    readonly ThemeWrite: "theme:write";
    readonly PreviewOpen: "preview:open";
    readonly PreviewStop: "preview:stop";
    readonly PreviewClose: "preview:close";
    readonly PreviewGetStatus: "preview:getStatus";
    readonly PreviewStatusChanged: "preview:statusChanged";
    readonly PreviewNavigate: "preview:navigate";
    /**
     * Renderer → main: push an updated page list / active page to an
     * already-open preview window. No-op when no preview is open for
     * the project (won't spawn one). Used so the dropdown stays
     * accurate when the user creates / renames / deletes a page in the
     * canvas while preview is open.
     */
    readonly PreviewUpdate: "preview:update";
    readonly PreviewRestart: "preview:restart";
    readonly TerminalCreate: "terminal:create";
    readonly TerminalWrite: "terminal:write";
    readonly TerminalResize: "terminal:resize";
    readonly TerminalKill: "terminal:kill";
    readonly TerminalData: "terminal:data";
    readonly TerminalExit: "terminal:exit";
    readonly TerminalForegroundProcess: "terminal:foregroundProcess";
    readonly ExportChooseSavePath: "export:chooseSavePath";
    readonly ExportPng: "export:png";
    readonly ExportSvg: "export:svg";
    readonly TestGetBootstrap: "test:getBootstrap";
};
export type IpcChannel = (typeof IPC)[keyof typeof IPC];
