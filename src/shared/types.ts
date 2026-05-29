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

/**
 * A reusable component definition. Lives at
 * `components/[Name]/[Name].tsx` + `[Name].module.css` inside a
 * Next.js-format project. Mirrors `PageFile`'s shape so the same
 * canvas / parse / generate / sync primitives can edit it.
 *
 * `name` is the PascalCase folder name (also the component's
 * React function name and the source-of-truth identifier
 * referenced by every instance's JSX tag and `import` line on
 * each page that uses it). Components are not supported in
 * legacy-format projects — `ProjectData.components` is always
 * an empty array there.
 */
export type ComponentFile = {
  name: string;
  tsxPath: string;
  cssPath: string;
  tsxContent: string;
  cssContent: string;
};

/**
 * Two on-disk formats are supported:
 * - `legacy`: flat layout — `<page>.tsx` + `<page>.module.css` at the
 *   project root, assets in `assets/`, no `app/` folder.
 * - `nextjs`: Next.js App Router layout — pages live as
 *   `app/<page>/page.tsx` (root page is `app/page.tsx`), assets in
 *   `public/assets/`, with auto-generated `app/layout.tsx`,
 *   `next.config.ts`, and `package.json`.
 *
 * Existing projects keep working in legacy format. New projects are
 * created in nextjs format. Migration from legacy → nextjs is opt-in
 * via a banner.
 */
export type ProjectFormat = 'legacy' | 'nextjs';

export type ProjectData = {
  path: string;
  name: string;
  format: ProjectFormat;
  pages: PageFile[];
  /**
   * Reusable component definitions scanned from `components/` at
   * project open. Always an empty array for legacy-format
   * projects (the components feature requires the Next.js
   * App Router layout).
   */
  components: ComponentFile[];
};

export type RecentProject = {
  name: string;
  path: string;
  format: ProjectFormat;
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
  /**
   * Anonymous crash-reporting consent (Sentry).
   *
   *   `null`  — the user has not been asked yet; the first-launch
   *             opt-in prompt fires.
   *   `true`  — Sentry is initialised with the privacy-safe config.
   *   `false` — the user declined; no Sentry SDK code runs.
   *
   * Set explicitly by the opt-in prompt and by the Settings →
   * Privacy toggle. Defaults to `null` for fresh installs and for
   * any legacy install whose `settings.json` predates this field.
   */
  sentryOptIn: boolean | null;
};

/**
 * Per-project configuration persisted as `scamp.config.json` at the
 * project root. Holds settings that are scoped to one project rather
 * than the whole app (artboard colour, future: snap grid, default
 * element names, etc.). Non-CSS concepts live here; CSS-flavoured
 * concepts (colour tokens, font imports) live in `theme.css`.
 */
/**
 * One entry in a project's breakpoint table. The `id` is the stable
 * key used in `ScampElement.breakpointOverrides`; the `width` is the
 * `max-width` value written into the `@media` query. Desktop is
 * included as a breakpoint but has no `@media` wrapper — its
 * "overrides" are the element's top-level fields.
 */
export type Breakpoint = {
  id: string;
  label: string;
  width: number;
};

/** Stable id of the desktop breakpoint — treated specially throughout. */
export const DESKTOP_BREAKPOINT_ID = 'desktop';

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
  /**
   * Per-project dismissal of the legacy → nextjs migration banner.
   * Independent of `canvasMigrationAcknowledged` (different banner,
   * different prompt). Once true, the banner stays hidden until the
   * user re-opens the project after a manual migration; ProjectShell
   * also implicitly stops showing the banner once the project's
   * format flips to nextjs.
   */
  nextjsMigrationDismissed?: boolean;
  /**
   * Responsive breakpoints for this project, ordered widest first.
   * Style edits in non-desktop mode land inside `@media
   * (max-width: Npx)` blocks keyed by each breakpoint's width.
   * Desktop (the widest) is the base — it has no `@media` wrapper.
   */
  breakpoints: Breakpoint[];
  /**
   * Per-component canvas dimensions for the component editor.
   * Keyed by PascalCase component name. Missing keys fall back
   * to `DEFAULT_COMPONENT_CANVAS_SIZE` so a brand-new component
   * gets a usable starting size without the user touching this
   * map. Mutated by the canvas-size control + the bottom-right
   * drag handle when the user resizes a component's canvas.
   *
   * Width / height are in logical pixels. Both are bounded by
   * MIN/MAX_CANVAS_WIDTH for symmetry with the page canvas
   * (height shares the same range — there's no reason a 4000px
   * tall design is illegal).
   *
   * Page canvas size lives at the top level (`canvasWidth`) and
   * grows vertically with content; only components have an
   * explicit height because their visible bounds are part of the
   * design intent.
   */
  componentCanvas?: Record<string, ComponentCanvasSize>;
};

export type ComponentCanvasSize = {
  width: number;
  height: number;
};

export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: DESKTOP_BREAKPOINT_ID, label: 'Desktop', width: 1440 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 390 },
];

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  artboardBackground: '#0f0f0f',
  canvasWidth: 1440,
  canvasOverflowHidden: false,
  breakpoints: DEFAULT_BREAKPOINTS,
};

/** Canvas-width bounds used by both the panel control and the parser. */
export const MIN_CANVAS_WIDTH = 100;
export const MAX_CANVAS_WIDTH = 4000;

/**
 * Component canvases can be much smaller than page canvases — a
 * button row at 240×40 is normal. Width and height share these
 * bounds and apply only in the component editor.
 */
export const MIN_COMPONENT_CANVAS_DIM = 20;
export const MAX_COMPONENT_CANVAS_DIM = 4000;

/**
 * Starting canvas size for a freshly-created component before the
 * user resizes it. Wide enough to fit a typical card / button
 * layout without feeling cramped; the user resizes via the drag
 * handle or the panel inputs as soon as the design needs it.
 */
export const DEFAULT_COMPONENT_CANVAS_SIZE: ComponentCanvasSize = {
  width: 480,
  height: 320,
};

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
  /**
   * Optimistic concurrency: when both `expected*` fields are
   * present, main reads the current disk content and refuses the
   * write if either path's content has drifted since the renderer
   * last serialized. Used by the syncBridge's debounced flush to
   * avoid clobbering an external agent's edit that landed between
   * the previous save and this one. See
   * docs/notes/agent-coexistence.md. Callers that don't care about
   * conflicts (export, scaffolds, migrate) omit both and main
   * skips the pre-write read.
   */
  expectedTsxContent?: string;
  expectedCssContent?: string;
};

export type FilePatchArgs = {
  cssPath: string;
  className: string;
  newDeclarations: string;
  /**
   * When present, the patch operates on the class rule INSIDE an
   * `@media (max-width: Npx)` block rather than on the base class.
   * The at-rule is created if it doesn't already exist; the class
   * rule is created inside it if missing. Omit for a base-class
   * patch (existing behavior).
   */
  media?: { maxWidth: number };
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

export type FileWriteResult =
  | { ok: true; writeId: string }
  | {
      ok: false;
      conflict: {
        /** Disk content at the moment main rejected the write. */
        actualTsxContent: string;
        actualCssContent: string;
      };
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

export type ComponentCreateArgs = {
  projectPath: string;
  /** PascalCase folder + component name. Caller is responsible for
   *  slugifying user input before sending — main re-validates. */
  componentName: string;
  /**
   * Optional initial TSX content. When omitted, the scaffold's
   * default `<div data-scamp-id="root"/>` template is written.
   * The convert-to-component flow passes pre-generated content
   * built from the source page subtree so the new component
   * captures the user's existing design as its initial body.
   */
  tsxContent?: string;
  /**
   * Optional initial CSS-module content. Paired with `tsxContent`
   * for the convert-to-component flow. Omitted callers get the
   * default blank `.root {}` block.
   */
  cssContent?: string;
};

export type ComponentDeleteArgs = {
  projectPath: string;
  componentName: string;
};

export type ComponentReadArgs = {
  projectPath: string;
  componentName: string;
};

/**
 * Write a small canvas thumbnail next to the sidebar component
 * row. The renderer passes a `data:image/png;base64,…` URL
 * captured via `html-to-image`; main decodes + writes to
 * `<projectPath>/.scamp/component-thumbs/<Name>.png`, creating
 * the parent directory tree if missing. Thumbnail capture is
 * best-effort: failures are surfaced via the return value but
 * don't propagate to the save indicator since the underlying
 * component save already succeeded.
 */
export type ComponentWriteThumbnailArgs = {
  projectPath: string;
  componentName: string;
  /** `data:image/png;base64,…` URL captured client-side. */
  dataUrl: string;
};

export type ComponentWriteThumbnailResult =
  | { ok: true; thumbnailPath: string }
  | { ok: false; error: string };

export type ComponentReadThumbnailArgs = {
  projectPath: string;
  componentName: string;
};

/**
 * Returned as a base64 PNG string (no `data:` prefix). Renderer
 * wraps it for `<img src>` rendering. Null when no thumbnail has
 * been written for this component yet — sidebar then renders a
 * placeholder.
 */
export type ComponentReadThumbnailResult = {
  base64: string | null;
};

export type ProjectMigrateArgs = {
  projectPath: string;
};

/**
 * Result of a successful legacy → nextjs migration. Carries the
 * post-migration project so the renderer can refresh its view, plus
 * the path to the kept-on-disk backup (so the UI can surface it as
 * "your originals are at <path> in case you need them").
 */
export type ProjectMigrateResult = {
  project: ProjectData;
  backupPath: string;
};

// Preview-mode IPC payloads

/**
 * Lifecycle of a per-project dev server.
 *
 *   - `idle`: no server registered for this project (defensive
 *     fallback; openPreview always kicks at least `installing` or
 *     `starting` immediately).
 *   - `installing`: `npm install` is running because `node_modules`
 *     was missing on first open. Logs accumulate so the preview
 *     window can show a tail.
 *   - `starting`: deps are present, `next dev` has been spawned, we
 *     haven't yet seen the "ready" line in stdout.
 *   - `ready`: dev server is accepting requests on `port`. The
 *     preview window's webview is safe to navigate.
 *   - `crashed`: the process exited non-zero before reaching ready,
 *     OR exited unexpectedly after reaching ready. UI shows the
 *     log tail + a Restart button.
 */
export type DevServerStatus =
  | { kind: 'idle' }
  | { kind: 'installing'; logs: ReadonlyArray<string> }
  | { kind: 'starting'; port: number; logs: ReadonlyArray<string> }
  | { kind: 'ready'; port: number; logs: ReadonlyArray<string> }
  | { kind: 'crashed'; logs: ReadonlyArray<string>; exitCode: number };

export type PreviewOpenArgs = {
  projectPath: string;
  /** Page name to navigate the preview to on open (e.g. `"home"` →
   *  `/`, `"about"` → `/about`). */
  pageName: string;
};

export type PreviewStopArgs = {
  projectPath: string;
};

export type PreviewRestartArgs = {
  projectPath: string;
};

export type PreviewGetStatusArgs = {
  projectPath: string;
};

/**
 * Pushed from main to the preview-window renderer whenever the
 * dev server's status changes. Carries the project path so a single
 * preview window listening to multiple projects (future) can
 * disambiguate; today every preview window listens to exactly one
 * project.
 */
export type PreviewStatusChangedPayload = {
  projectPath: string;
  status: DevServerStatus;
};

/**
 * Pushed from main to the preview-window renderer when the parent
 * (canvas) wants the preview to navigate to a specific page —
 * triggered by Cmd+P on a different page than the preview is
 * currently showing.
 */
export type PreviewNavigatePayload = {
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

/**
 * Foreground-process status for a pty. Emitted by the main-side
 * poller whenever the pty's foreground command changes.
 *
 *   - `processName: null` — pty is at a shell prompt (idle). The
 *     foreground process is the shell itself.
 *   - `processName: 'claude' | 'aider' | …` — a non-shell command
 *     is currently in the foreground; an agent is presumed running.
 *
 * The renderer's `terminalActivitySlice` maintains a per-terminal
 * map and a derived `anyAgentActive` selector. The sync bridge
 * subscribes to that selector and pauses when any pty is busy.
 */
export type TerminalForegroundProcessPayload = {
  id: string;
  processName: string | null;
};

/**
 * Returned by `test:getBootstrap`. Off in normal usage; only populated
 * when the app is launched with `SCAMP_E2E=1`. The renderer uses this
 * to skip the Start Screen and auto-open a test project.
 */
export type TestBootstrap = {
  e2e: boolean;
  autoOpenProjectPath: string | null;
};

// ---- Export IPC payloads ---------------------------------------------

export type ExportFormat = 'png' | 'svg';

export type ExportChooseSavePathArgs = {
  /** Suggested filename (no extension — the handler appends it). */
  filename: string;
  format: ExportFormat;
  /** Default folder hint, typically the project path. */
  defaultDir?: string;
};

export type ExportChooseSavePathResult = {
  canceled: boolean;
  path: string | null;
};

export type ExportPngArgs = {
  /** Captured PNG as a base64 data URL (`data:image/png;base64,…`). */
  dataUrl: string;
  path: string;
};

export type ExportSvgArgs = {
  svgString: string;
  path: string;
};

export type ExportResult = {
  ok: boolean;
  /** Populated on failure — short, user-readable. */
  error?: string;
};
