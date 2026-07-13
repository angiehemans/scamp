import type { Breakpoint, ComponentCanvasSize, ProjectConfig } from './types';
/** Clamp a raw canvasWidth candidate to the supported range. */
export declare const clampCanvasWidth: (value: unknown) => number;
/**
 * Validate a raw breakpoints array candidate. Bad entries are dropped
 * (not corrected); if the result has no desktop breakpoint, the
 * entire field falls back to defaults so downstream code always has
 * a valid base breakpoint to anchor to.
 */
export declare const parseBreakpoints: (value: unknown) => Breakpoint[];
/**
 * Validate the `componentCanvas` map. Each value must be a
 * `{ width, height }` pair with finite numbers in the
 * `MIN_CANVAS_WIDTH`–`MAX_CANVAS_WIDTH` range; bad entries are
 * dropped silently so a partially-broken map still opens. Returns
 * undefined when the input is absent or fully invalid, so the
 * field round-trips text-stable for projects that haven't used the
 * feature.
 */
export declare const parseComponentCanvas: (value: unknown) => Record<string, ComponentCanvasSize> | undefined;
/**
 * Validate the per-breakpoint clip map. Keeps only entries whose value is
 * `true` (an absent/false key already means "don't clip"), so the stored
 * object stays minimal and round-trips text-stable. Returns undefined when
 * empty so projects that never touched clip don't grow a `{}`.
 */
export declare const parseClipByBreakpoint: (value: unknown) => Record<string, boolean> | undefined;
/** Legacy → per-breakpoint clip: a legacy `true` seeds the desktop key. */
export declare const seedClipFromLegacy: (legacy: boolean) => Record<string, boolean> | undefined;
/**
 * Resolve the effective page-canvas clip state for a breakpoint. Reads the
 * per-breakpoint map; a missing entry means "don't clip".
 */
export declare const resolveClip: (config: Pick<ProjectConfig, "canvasClipByBreakpoint">, breakpointId: string) => boolean;
/** Clamp a raw canvasHeight candidate to the supported range. */
export declare const clampCanvasHeight: (value: unknown) => number;
/**
 * Parse a raw `scamp.config.json` string into a validated `ProjectConfig`.
 * Every missing or malformed field falls back to the default so a file
 * someone hand-edited to nonsense still opens, just without the bad
 * overrides. Mirrors the forgiving pattern in `settings.ts`.
 */
export declare const parseProjectConfig: (raw: string | null) => ProjectConfig;
/** Serialize a `ProjectConfig` to its on-disk JSON form. */
export declare const serializeProjectConfig: (config: ProjectConfig) => string;
