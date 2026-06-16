import { useEffect } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { useFontsStore } from '@store/fontsSlice';
import { useTerminalActivityStore } from '@store/terminalActivitySlice';
import { parseThemeFile } from '@lib/parseTheme';
import { applyThemeFonts } from '@renderer/src/lib/applyThemeFonts';

/**
 * Keeps a `<link rel="stylesheet">` per project font URL in
 * `document.head` so the canvas preview actually loads the referenced
 * Google Fonts stylesheet. Reconciles on delta — unchanged URLs keep
 * their tag (and the browser's cached stylesheet) across renders — and
 * strips every injected tag on unmount so a different project doesn't
 * inherit this one's fonts.
 */
export const useFontLinkReconciler = (): void => {
  const projectFontUrls = useFontsStore((s) => s.projectFontUrls);
  useEffect(() => {
    const ATTR = 'data-scamp-font-import';
    const existing = new Map<string, HTMLLinkElement>();
    document
      .querySelectorAll<HTMLLinkElement>(`link[${ATTR}]`)
      .forEach((el) => {
        const u = el.getAttribute(ATTR);
        if (u) existing.set(u, el);
      });
    const wanted = new Set(projectFontUrls);
    for (const [url, el] of existing) {
      if (!wanted.has(url)) el.remove();
    }
    for (const url of projectFontUrls) {
      if (existing.has(url)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute(ATTR, url);
      document.head.appendChild(link);
    }
  }, [projectFontUrls]);
  // On ProjectShell unmount (project closed) strip every injected tag
  // so a different project doesn't inherit this one's fonts.
  useEffect(() => {
    return () => {
      document
        .querySelectorAll<HTMLLinkElement>(`link[data-scamp-font-import]`)
        .forEach((el) => el.remove());
    };
  }, []);
};

/**
 * Loads theme tokens + font imports from `theme.css` on project open and
 * resets the font picker + sync intent on unmount so a stale project's
 * state doesn't bleed into the next.
 */
export const useProjectTheme = (projectPath: string): void => {
  useEffect(() => {
    const loadTheme = async (): Promise<void> => {
      const content = await window.scamp.readTheme({ projectPath });
      const parsed = parseThemeFile(content);
      useCanvasStore.getState().setThemeTokens(parsed.tokens);
      // `applyThemeFonts` derives Google families synchronously from
      // each URL, surfaces any cached Adobe kit families, then kicks
      // off background fetches to refresh Adobe kits from the network.
      applyThemeFonts(parsed.fontImportUrls);
    };
    void loadTheme();
    return () => {
      // Clear when the project unmounts so a stale project's fonts
      // don't linger in the picker.
      useFontsStore.getState().setProjectFonts({ families: [], urls: [] });
      // Reset the user's sync intent so a manual pause or override
      // from one project doesn't bleed into the next.
      useTerminalActivityStore.getState().setUserIntent('auto');
    };
  }, [projectPath]);
};
