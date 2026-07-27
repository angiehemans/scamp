// applyAppTheme.ts — DOM/localStorage side effects for the app-chrome theme.
// Kept out of `@lib` (which must be pure + node-tested); the pure
// normalization lives in `@lib/appTheme`.
import { TITLE_BAR_COLORS } from '@shared/titleBarColors';
import { THEME_STORAGE_KEY, normalizeTheme } from '@lib/appTheme';
/** The theme to paint at boot, from the fast localStorage mirror. */
export const readInitialAppTheme = () => normalizeTheme(globalThis.localStorage?.getItem(THEME_STORAGE_KEY));
/**
 * Apply `theme` to the document and refresh the localStorage mirror.
 * `settings.json` remains the source of truth; the mirror only exists so
 * boot (and the pre-paint script in index.html) can pick the palette
 * without an IPC round-trip.
 */
export const applyAppTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
    // Recolor the native window-controls overlay to match (no-op on macOS,
    // handled main-side). Optional-chained for tests / non-Electron contexts.
    window.scamp?.setTitleBarOverlayColors(TITLE_BAR_COLORS[theme]);
};
