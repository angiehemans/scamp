import type { ProjectFormat } from '@shared/types';

/**
 * Lightweight basename helper for the renderer. Avoids importing Node's
 * `path` module from the renderer, which has no business reading the
 * filesystem (CLAUDE.md rule).
 */
export const basename = (p: string): string => {
  const parts = p.split(/[/\\]/).filter((segment) => segment.length > 0);
  return parts[parts.length - 1] ?? p;
};

/**
 * Project-relative path of the assets directory for the given format.
 * Used to construct the `defaultPath` for the native file dialog so it
 * opens in the right folder. Always uses forward slashes — the main
 * process normalises separators per-platform.
 */
export const assetsDirSegment = (format: ProjectFormat): string =>
  format === 'nextjs' ? 'public/assets' : 'assets';
