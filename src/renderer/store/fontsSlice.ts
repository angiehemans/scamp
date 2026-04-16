import { create } from 'zustand';

/**
 * Shape returned by the Local Font Access API (`window.queryLocalFonts`).
 * We only declare what we use — the real object has more fields
 * (`fullName`, `postscriptName`, `style`, `blob()`).
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Local_Font_Access_API
 */
type FontData = {
  family: string;
};

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<FontData[]>;
  }
}

/**
 * Baseline list used when the Local Font Access API isn't available
 * (older Electron, permission denied, non-Chromium surface). Keeps the
 * picker usable even if enumeration fails.
 */
const FALLBACK_SYSTEM_FONTS: ReadonlyArray<string> = [
  'Arial',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Times New Roman',
  'Verdana',
];

export type FontSource = 'system' | 'project';

export type AvailableFont = {
  family: string;
  source: FontSource;
};

type FontsState = {
  /** De-duplicated, alphabetically sorted family names. */
  systemFonts: ReadonlyArray<string>;
  /** Whether the initial enumeration has finished (success or fallback). */
  systemFontsLoaded: boolean;
  /**
   * Family names derived from the active project's `theme.css` font
   * imports. Populated by the theme-file sync pipeline, not by the
   * slice itself.
   */
  projectFonts: ReadonlyArray<string>;
  /** Raw Google Fonts `@import` URLs the project tracks. */
  projectFontUrls: ReadonlyArray<string>;
  loadSystemFonts: () => Promise<void>;
  setProjectFonts: (input: {
    families: ReadonlyArray<string>;
    urls: ReadonlyArray<string>;
  }) => void;
};

export const useFontsStore = create<FontsState>((set, get) => ({
  systemFonts: [],
  systemFontsLoaded: false,
  projectFonts: [],
  projectFontUrls: [],
  setProjectFonts: ({ families, urls }) => {
    set({
      projectFonts: [...families],
      projectFontUrls: [...urls],
    });
  },
  loadSystemFonts: async () => {
    // Guard against double-load — `App.tsx` fires this on mount; a
    // future callsite might too. Once loaded, bail.
    if (get().systemFontsLoaded) return;

    const finish = (families: ReadonlyArray<string>): void => {
      set({ systemFonts: families, systemFontsLoaded: true });
    };

    if (typeof window.queryLocalFonts !== 'function') {
      finish(FALLBACK_SYSTEM_FONTS);
      return;
    }

    try {
      const fonts = await window.queryLocalFonts();
      const families = Array.from(
        new Set(fonts.map((f) => f.family).filter((f) => f.length > 0))
      ).sort((a, b) => a.localeCompare(b));
      if (families.length === 0) {
        finish(FALLBACK_SYSTEM_FONTS);
        return;
      }
      finish(families);
    } catch (e) {
      // Permission denied, origin check failed, or the platform doesn't
      // expose the API. Fall back so the user can still pick a font.
      // eslint-disable-next-line no-console
      console.warn('[fonts] queryLocalFonts failed, using fallback list', e);
      finish(FALLBACK_SYSTEM_FONTS);
    }
  },
}));

/**
 * Merge project fonts + system fonts into one picker list. Project
 * fonts come first (the user actively added them) and shadow any
 * same-named system font, so the `Project` badge accurately reflects
 * the font source.
 */
export const selectAllFonts = (state: FontsState): ReadonlyArray<AvailableFont> => {
  const result: AvailableFont[] = [];
  const seen = new Set<string>();
  for (const family of state.projectFonts) {
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ family, source: 'project' });
  }
  for (const family of state.systemFonts) {
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ family, source: 'system' });
  }
  return result;
};
