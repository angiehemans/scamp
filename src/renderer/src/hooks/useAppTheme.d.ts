import type { AppTheme } from '@shared/types';
/**
 * The active app-chrome theme, reactive to `data-theme` on <html>. Backed by
 * useSyncExternalStore + a MutationObserver so components (e.g. the code
 * editors, which can't read a CSS variable for their JS-driven theme) update
 * the instant the user flips the toggle.
 */
export declare const useAppTheme: () => AppTheme;
