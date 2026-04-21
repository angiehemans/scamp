import type { ProjectConfig } from './types';
import {
  DEFAULT_PROJECT_CONFIG,
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
  return {
    artboardBackground: isValidColor(artboard)
      ? artboard
      : DEFAULT_PROJECT_CONFIG.artboardBackground,
    canvasWidth,
    canvasOverflowHidden,
    ...(canvasMigrationAcknowledged ? { canvasMigrationAcknowledged: true } : {}),
  };
};

/** Serialize a `ProjectConfig` to its on-disk JSON form. */
export const serializeProjectConfig = (config: ProjectConfig): string => {
  return JSON.stringify(config, null, 2) + '\n';
};
