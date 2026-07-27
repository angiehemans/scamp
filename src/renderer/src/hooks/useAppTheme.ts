import { useSyncExternalStore } from 'react';
import type { AppTheme } from '@shared/types';
import { normalizeTheme } from '@lib/appTheme';

const getSnapshot = (): AppTheme =>
  normalizeTheme(document.documentElement.dataset.theme);

const subscribe = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
};

/**
 * The active app-chrome theme, reactive to `data-theme` on <html>. Backed by
 * useSyncExternalStore + a MutationObserver so components (e.g. the code
 * editors, which can't read a CSS variable for their JS-driven theme) update
 * the instant the user flips the toggle.
 */
export const useAppTheme = (): AppTheme =>
  useSyncExternalStore(subscribe, getSnapshot);
