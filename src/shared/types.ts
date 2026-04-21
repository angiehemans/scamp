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
  /**
   * Background color of the artboard — the area behind the canvas.
   * @deprecated Moved to per-project config (`scamp.config.json`). Kept
   * on the type for one release so old installs don't crash on a
   * missing key; no UI reads from it.
   */
  artboardBackground: string;
};

/**
 * Per-project configuration persisted as `scamp.config.json` at the
 * project root. Holds settings that are scoped to one project rather
 * than the whole app (artboard colour, future: snap grid, default
 * element names, etc.). Non-CSS concepts live here; CSS-flavoured
 * concepts (colour tokens, font imports) live in `theme.css`.
 */
export type ProjectConfig = {
  /** Background color of the artboard — the area behind the canvas. */
  artboardBackground: string;
  /**
   * Width of the canvas viewport frame in logical pixels. Purely a
   * design-tool preference — never written to the page CSS. Typical
   * presets: 390 (Mobile), 768 (Tablet), 1440 (Desktop), 1920 (Wide),
   * or any custom value.
   */
  canvasWidth: number;
  /**
   * When true, the viewport frame clips content that extends outside
   * its width. Useful for previewing how a layout behaves at a
   * specific width without content spilling. Does NOT affect the
   * root element's CSS.
   */
  canvasOverflowHidden: boolean;
  /**
   * One-shot flag — set after the user has dismissed the canvas-size
   * migration banner. Once true, the banner never shows again for
   * this project even if subsequent opens somehow re-trigger the
   * migration detector.
   */
  canvasMigrationAcknowledged?: boolean;
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  artboardBackground: '#0f0f0f',
  canvasWidth: 1440,
  canvasOverflowHidden: false,
};

/** Canvas-width bounds used by both the panel control and the parser. */
export const MIN_CANVAS_WIDTH = 100;
export const MAX_CANVAS_WIDTH = 4000;

export type ProjectConfigReadArgs = {
  projectPath: string;
};

export type ProjectConfigWriteArgs = {
  projectPath: string;
  config: ProjectConfig;
};

export type ThemeToken = {
  /** The CSS custom property name, e.g. `--color-primary`. */
  name: string;
  /** The resolved value, e.g. `#3b82f6`. */
  value: string;
};

export type CopyImageArgs = {
  sourcePath: string;
  projectPath: string;
};

export type CopyImageResult = {
  relativePath: string;
  fileName: string;
};

export type ChooseImageArgs = {
  /** Optional directory to open the dialog in (e.g. project assets folder). */
  defaultPath?: string;
};

export type ChooseImageResult = {
  canceled: boolean;
  path: string | null;
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

/**
 * Emitted by main once a chokidar stability event confirms a write
 * initiated by the renderer has settled on disk. Correlated by
 * `writeId` — the opaque id returned from `file:write` / `file:patch`.
 *
 * Per-path (tsx and css acks arrive as separate events) so the renderer
 * can track which sibling has landed.
 */
export type FileWriteAckPayload = {
  writeId: string;
  path: string;
};

export type FileWriteResult = {
  writeId: string;
};

export type FilePatchResult = {
  writeId: string;
};

export type PageCreateArgs = {
  projectPath: string;
  pageName: string;
};

export type PageDeleteArgs = {
  projectPath: string;
  pageName: string;
};

export type PageDuplicateArgs = {
  projectPath: string;
  sourcePageName: string;
  newPageName: string;
};

export type PageRenameArgs = {
  projectPath: string;
  oldPageName: string;
  newPageName: string;
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
