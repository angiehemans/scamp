// The `theme:changed` listener: theme.css now holds both design tokens
// and font imports, so a change updates the canvas token store and the
// project-fonts store. Lifted out of initSyncBridge (Phase 5.4) — fully
// self-contained, no shared cache.
import { useCanvasStore } from '@store/canvasSlice';
import { parseThemeFile } from '@lib/parseTheme';

import { applyThemeFonts } from '../lib/applyThemeFonts';

export const makeThemeChangedHandler = () => (content: string): void => {
  const parsed = parseThemeFile(content);
  useCanvasStore.getState().setThemeTokens(parsed.tokens);
  applyThemeFonts(parsed.fontImportUrls);
};
