import type { ProjectConfig } from './types';
import { DEFAULT_PROJECT_CONFIG } from './types';

const isValidColor = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !/[\n\r\t]/.test(value);

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
  return {
    artboardBackground: isValidColor(artboard)
      ? artboard
      : DEFAULT_PROJECT_CONFIG.artboardBackground,
  };
};

/** Serialize a `ProjectConfig` to its on-disk JSON form. */
export const serializeProjectConfig = (config: ProjectConfig): string => {
  return JSON.stringify(config, null, 2) + '\n';
};
