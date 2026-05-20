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
 * Parse a raw `scamp.config.json` string into a validated `ProjectConfig`.
 * Every missing or malformed field falls back to the default so a file
 * someone hand-edited to nonsense still opens, just without the bad
 * overrides. Mirrors the forgiving pattern in `settings.ts`.
 */
export declare const parseProjectConfig: (raw: string | null) => ProjectConfig;
/** Serialize a `ProjectConfig` to its on-disk JSON form. */
export declare const serializeProjectConfig: (config: ProjectConfig) => string;
