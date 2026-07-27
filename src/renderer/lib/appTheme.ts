// @lib/appTheme.ts — pure helpers for the app-chrome theme. The DOM /
// localStorage side effects live in `src/renderer/src/lib/applyAppTheme.ts`;
// this file stays pure so it's node-testable per CLAUDE.md.

import type { AppTheme } from '@shared/types';

/** localStorage key mirroring the persisted `Settings.theme`, read
 *  synchronously at boot so the first paint uses the right palette. */
export const THEME_STORAGE_KEY = 'scamp.theme';

/** Coerce any stored/loaded value to a theme we ship; dark is the fallback. */
export const normalizeTheme = (value: unknown): AppTheme =>
  value === 'light' ? 'light' : 'dark';
