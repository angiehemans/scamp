import type { AppTheme } from '@shared/types';
/** localStorage key mirroring the persisted `Settings.theme`, read
 *  synchronously at boot so the first paint uses the right palette. */
export declare const THEME_STORAGE_KEY = "scamp.theme";
/** Coerce any stored/loaded value to a theme we ship; dark is the fallback. */
export declare const normalizeTheme: (value: unknown) => AppTheme;
