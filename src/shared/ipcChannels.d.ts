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
    readonly FileWrite: "file:write";
    readonly FilePatch: "file:patch";
    readonly FileChanged: "file:changed";
    readonly FileWriteAck: "file:writeAck";
    readonly PageCreate: "page:create";
    readonly PageDelete: "page:delete";
    readonly PageDuplicate: "page:duplicate";
    readonly PageRename: "page:rename";
    readonly RecentProjectsGet: "recentProjects:get";
    readonly RecentProjectsRemove: "recentProjects:remove";
    readonly SettingsGet: "settings:get";
    readonly SettingsSetDefaultFolder: "settings:setDefaultFolder";
    readonly SettingsUpdate: "settings:update";
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
    readonly PreviewRestart: "preview:restart";
    readonly TerminalCreate: "terminal:create";
    readonly TerminalWrite: "terminal:write";
    readonly TerminalResize: "terminal:resize";
    readonly TerminalKill: "terminal:kill";
    readonly TerminalData: "terminal:data";
    readonly TerminalExit: "terminal:exit";
    readonly TestGetBootstrap: "test:getBootstrap";
};
export type IpcChannel = (typeof IPC)[keyof typeof IPC];
