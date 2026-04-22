import type { Breakpoint, ProjectConfig } from './types';
import {
  DEFAULT_BREAKPOINTS,
  DEFAULT_PROJECT_CONFIG,
  DESKTOP_BREAKPOINT_ID,
  MAX_CANVAS_WIDTH,
  MIN_CANVAS_WIDTH,
} from './types';

const isValidColor = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !/[\n\r\t]/.test(value);

/** Clamp a raw canvasWidth candidate to the supported range. */
export const clampCanvasWidth = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PROJECT_CONFIG.canvasWidth;
  }
  return Math.round(Math.max(MIN_CANVAS_WIDTH, Math.min(MAX_CANVAS_WIDTH, value)));
};

/**
 * Validate a raw breakpoints array candidate. Bad entries are dropped
 * (not corrected); if the result has no desktop breakpoint, the
 * entire field falls back to defaults so downstream code always has
 * a valid base breakpoint to anchor to.
 */
export const parseBreakpoints = (value: unknown): Breakpoint[] => {
  if (!Array.isArray(value)) return [...DEFAULT_BREAKPOINTS];
  const seenIds = new Set<string>();
  const result: Breakpoint[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = o['id'];
    const label = o['label'];
    const width = o['width'];
    if (typeof id !== 'string' || id.length === 0) continue;
    if (typeof label !== 'string' || label.length === 0) continue;
    if (typeof width !== 'number' || !Number.isFinite(width)) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    result.push({
      id,
      label,
      width: Math.round(Math.max(MIN_CANVAS_WIDTH, Math.min(MAX_CANVAS_WIDTH, width))),
    });
  }
  // A project must always have a desktop breakpoint — it's the base
  // that every other breakpoint's @media cascade falls through to.
  if (!seenIds.has(DESKTOP_BREAKPOINT_ID)) return [...DEFAULT_BREAKPOINTS];
  // Sort widest first so render / emit order is consistent.
  result.sort((a, b) => b.width - a.width);
  return result;
};

/**
 * Parse a raw `scamp.config.json` string into a validated `ProjectConfig`.
 * Every missing or malformed field falls back to the default so a file
 * someone hand-edited to nonsense still opens, just without the bad
 * overrides. Mirrors the forgiving pattern in `settings.ts`.
 */
export const parseProjectConfig = (raw: string | null): ProjectConfig => {
  if (raw === null) return { ...DEFAULT_PROJECT_CONFIG };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
  const obj = parsed as Record<string, unknown>;
  const artboard = obj['artboardBackground'];
  const canvasWidth = clampCanvasWidth(obj['canvasWidth']);
  const canvasOverflowHidden =
    typeof obj['canvasOverflowHidden'] === 'boolean'
      ? obj['canvasOverflowHidden']
      : DEFAULT_PROJECT_CONFIG.canvasOverflowHidden;
  const canvasMigrationAcknowledged =
    obj['canvasMigrationAcknowledged'] === true ? true : undefined;
  const breakpoints =
    obj['breakpoints'] === undefined
      ? [...DEFAULT_BREAKPOINTS]
      : parseBreakpoints(obj['breakpoints']);
  return {
    artboardBackground: isValidColor(artboard)
      ? artboard
      : DEFAULT_PROJECT_CONFIG.artboardBackground,
    canvasWidth,
    canvasOverflowHidden,
    breakpoints,
    ...(canvasMigrationAcknowledged ? { canvasMigrationAcknowledged: true } : {}),
  };
};

/** Serialize a `ProjectConfig` to its on-disk JSON form. */
export const serializeProjectConfig = (config: ProjectConfig): string => {
  return JSON.stringify(config, null, 2) + '\n';
};
