import type { ChooseFolderResult, ChooseImageArgs, ChooseImageResult, CopyImageArgs, CopyImageResult, CreateProjectArgs, FileChangedPayload, FilePatchArgs, FilePatchResult, FileWriteAckPayload, FileWriteArgs, FileWriteResult, OpenProjectArgs, PageCreateArgs, PageDeleteArgs, PageDuplicateArgs, PageFile, PageRenameArgs, ProjectConfig, ProjectConfigReadArgs, ProjectConfigWriteArgs, ProjectData, PreviewOpenArgs, ProjectMigrateArgs, ProjectMigrateResult, RecentProject, Settings, TerminalCreateArgs, TerminalCreateResult, TerminalDataPayload, TerminalExitPayload, TerminalKillArgs, TerminalResizeArgs, TerminalWriteArgs, TestBootstrap } from '@shared/types';
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
    getRecentProjects: () => Promise<Array<RecentProject & {
        exists: boolean;
    }>>;
    removeRecentProject: (path: string) => Promise<void>;
    getSettings: () => Promise<Settings>;
    setDefaultProjectsFolder: (path: string | null) => Promise<Settings>;
    updateSettings: (patch: Partial<Settings>) => Promise<Settings>;
    readProjectConfig: (args: ProjectConfigReadArgs) => Promise<ProjectConfig>;
    writeProjectConfig: (args: ProjectConfigWriteArgs) => Promise<ProjectConfig>;
    onFileChanged: (handler: (payload: FileChangedPayload) => void) => (() => void);
    onFileWriteAck: (handler: (payload: FileWriteAckPayload) => void) => (() => void);
    copyImage: (args: CopyImageArgs) => Promise<CopyImageResult>;
    chooseImage: (args?: ChooseImageArgs) => Promise<ChooseImageResult>;
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
    getTestBootstrap: () => Promise<TestBootstrap>;
};
export type ScampApi = typeof api;
export {};
