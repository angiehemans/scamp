import type { AppTheme } from './types';

/** Colors for the native window-controls overlay (min/max/close buttons
 *  Electron draws on Windows/Linux). `color` is the bar background,
 *  `symbolColor` the glyph color. Kept here so main (initial paint) and
 *  the renderer (recolor on theme toggle) stay in lockstep, and matched to
 *  the `--bg-header` / `--text-primary` tokens in theme.css. */
export type TitleBarColors = { color: string; symbolColor: string };

/** Height of the title bar, shared by the overlay (main) and the HTML
 *  strip (renderer CSS fallback for `env(titlebar-area-height)`). */
export const TITLE_BAR_HEIGHT = 36;

export const TITLE_BAR_COLORS: Record<AppTheme, TitleBarColors> = {
  dark: { color: '#232323', symbolColor: '#e0e0e0' },
  light: { color: '#ededed', symbolColor: '#1c1c1c' },
};
