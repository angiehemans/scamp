import type { ChooseFolderResult, ChooseImageArgs, ChooseImageResult, CopyImageArgs, CopyImageResult, CreateProjectArgs, ExportChooseSavePathArgs, ExportChooseSavePathResult, ExportPngArgs, ExportResult, ExportSvgArgs, FileChangedPayload, FilePatchArgs, FilePatchResult, FileWriteAckPayload, FileWriteArgs, FileWriteResult, OpenProjectArgs, ComponentCreateArgs, ComponentDeleteArgs, ComponentFile, ComponentReadArgs, ComponentReadThumbnailArgs, ComponentReadThumbnailResult, ComponentWriteThumbnailArgs, ComponentWriteThumbnailResult, PageCreateArgs, PageDeleteArgs, PageDuplicateArgs, PageFile, PageRenameArgs, ProjectConfig, ProjectConfigReadArgs, ProjectConfigWriteArgs, ProjectData, PreviewOpenArgs, ProjectMigrateArgs, ProjectMigrateResult, RecentProject, Settings, SnapshotCreateArgs, SnapshotCreateResult, SnapshotDeleteArgs, SnapshotDeleteResult, SnapshotListArgs, SnapshotListResult, SnapshotReadPageArgs, SnapshotReadPageResult, SnapshotRestoreArgs, SnapshotRestoreResult, TerminalCreateArgs, TerminalCreateResult, TerminalDataPayload, TerminalExitPayload, TerminalForegroundProcessPayload, TerminalKillArgs, TerminalResizeArgs, TerminalWriteArgs, TestBootstrap, UpdaterInfoPayload, UpdaterProgressPayload } from '@shared/types';
/**
 * Minimal API surface exposed to the renderer. Keep this small — every
 * function here is a potential attack surface and a contract that must
 * stay stable.
 */
declare const api: {
    chooseFolder: () => Promise<ChooseFolderResult>;
    createProject: (args: CreateProjectArgs) => Promise<ProjectData>;
    openProject: (args: OpenProjectArgs) => Promise<ProjectData>;
    readProject: (args: OpenProjectArgs) => Promise<ProjectData>;
    migrateProject: (args: ProjectMigrateArgs) => Promise<ProjectMigrateResult>;
    /**
     * Open (or focus + navigate) the preview window for the project.
     * Returns the window id so callers can correlate; main spawns the
     * dev server in parallel as the window opens.
     */
    openPreview: (args: PreviewOpenArgs) => Promise<{
        windowId: number;
    }>;
    /**
     * Push an updated active page + page list to an already-open
     * preview window. No-op if no preview is open for the project
     * (won't spawn one). Used so the URL-bar dropdown stays accurate
     * when the user adds / renames / deletes a page in the canvas.
     */
    updatePreview: (args: PreviewOpenArgs) => Promise<void>;
    /**
     * Close the preview window AND stop its dev server for a project.
     * Called when the user closes the project — preview shouldn't
     * outlive the project that's editing it.
     */
    closePreview: (projectPath: string) => Promise<void>;
    writeFile: (args: FileWriteArgs) => Promise<FileWriteResult>;
    patchFile: (args: FilePatchArgs) => Promise<FilePatchResult>;
    createPage: (args: PageCreateArgs) => Promise<PageFile>;
    deletePage: (args: PageDeleteArgs) => Promise<void>;
    duplicatePage: (args: PageDuplicateArgs) => Promise<PageFile>;
    renamePage: (args: PageRenameArgs) => Promise<PageFile>;
    createComponent: (args: ComponentCreateArgs) => Promise<ComponentFile>;
    deleteComponent: (args: ComponentDeleteArgs) => Promise<void>;
    readComponent: (args: ComponentReadArgs) => Promise<ComponentFile | null>;
    writeComponentThumbnail: (args: ComponentWriteThumbnailArgs) => Promise<ComponentWriteThumbnailResult>;
    readComponentThumbnail: (args: ComponentReadThumbnailArgs) => Promise<ComponentReadThumbnailResult>;
    createSnapshot: (args: SnapshotCreateArgs) => Promise<SnapshotCreateResult>;
    listSnapshots: (args: SnapshotListArgs) => Promise<SnapshotListResult>;
    restoreSnapshot: (args: SnapshotRestoreArgs) => Promise<SnapshotRestoreResult>;
    deleteSnapshot: (args: SnapshotDeleteArgs) => Promise<SnapshotDeleteResult>;
    readSnapshotPage: (args: SnapshotReadPageArgs) => Promise<SnapshotReadPageResult>;
    getRecentProjects: () => Promise<Array<RecentProject & {
        exists: boolean;
    }>>;
    removeRecentProject: (path: string) => Promise<void>;
    getSettings: () => Promise<Settings>;
    setDefaultProjectsFolder: (path: string | null) => Promise<Settings>;
    updateSettings: (patch: Partial<Settings>) => Promise<Settings>;
    /** Trigger the main process to (re-)initialise or shut down Sentry
     *  in response to the Privacy toggle changing or the first-launch
     *  opt-in prompt being answered. */
    reinitSentry: (optedIn: boolean) => Promise<void>;
    /** The Scamp app version (from package.json) — useful in any
     *  diagnostic UI that wants to surface it. */
    getAppVersion: () => Promise<string>;
    readProjectConfig: (args: ProjectConfigReadArgs) => Promise<ProjectConfig>;
    writeProjectConfig: (args: ProjectConfigWriteArgs) => Promise<ProjectConfig>;
    onFileChanged: (handler: (payload: FileChangedPayload) => void) => (() => void);
    onProjectPagesChanged: (handler: () => void) => (() => void);
    onFileWriteAck: (handler: (payload: FileWriteAckPayload) => void) => (() => void);
    copyImage: (args: CopyImageArgs) => Promise<CopyImageResult>;
    chooseImage: (args?: ChooseImageArgs) => Promise<ChooseImageResult>;
    exportChooseSavePath: (args: ExportChooseSavePathArgs) => Promise<ExportChooseSavePathResult>;
    exportPng: (args: ExportPngArgs) => Promise<ExportResult>;
    exportSvg: (args: ExportSvgArgs) => Promise<ExportResult>;
    readTheme: (args: {
        projectPath: string;
    }) => Promise<string>;
    writeTheme: (args: {
        projectPath: string;
        content: string;
    }) => Promise<void>;
    onThemeChanged: (handler: (content: string) => void) => (() => void);
    createTerminal: (args: TerminalCreateArgs) => Promise<TerminalCreateResult>;
    writeTerminal: (args: TerminalWriteArgs) => Promise<void>;
    resizeTerminal: (args: TerminalResizeArgs) => Promise<void>;
    killTerminal: (args: TerminalKillArgs) => Promise<void>;
    onTerminalData: (handler: (payload: TerminalDataPayload) => void) => (() => void);
    onTerminalExit: (handler: (payload: TerminalExitPayload) => void) => (() => void);
    onTerminalForegroundProcess: (handler: (payload: TerminalForegroundProcessPayload) => void) => (() => void);
    installUpdateNow: () => Promise<void>;
    onUpdaterAvailable: (handler: (info: UpdaterInfoPayload) => void) => (() => void);
    onUpdaterProgress: (handler: (progress: UpdaterProgressPayload) => void) => (() => void);
    onUpdaterDownloaded: (handler: (info: UpdaterInfoPayload) => void) => (() => void);
    onUpdaterError: (handler: (message: string) => void) => (() => void);
    getTestBootstrap: () => Promise<TestBootstrap>;
};
export type ScampApi = typeof api;
export {};
