import type { AppTheme } from '@shared/types';
/** The theme to paint at boot, from the fast localStorage mirror. */
export declare const readInitialAppTheme: () => AppTheme;
/**
 * Apply `theme` to the document and refresh the localStorage mirror.
 * `settings.json` remains the source of truth; the mirror only exists so
 * boot (and the pre-paint script in index.html) can pick the palette
 * without an IPC round-trip.
 */
export declare const applyAppTheme: (theme: AppTheme) => void;
