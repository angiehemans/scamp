import { create } from 'zustand';
/**
 * Baseline list used when the Local Font Access API isn't available
 * (older Electron, permission denied, non-Chromium surface). Keeps the
 * picker usable even if enumeration fails.
 */
const FALLBACK_SYSTEM_FONTS = [
    'Arial',
    'Courier New',
    'Georgia',
    'Helvetica',
    'Times New Roman',
    'Verdana',
];
export const useFontsStore = create((set, get) => ({
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
        // future callsite might too. Once loaded, bail. Use
        // `refreshSystemFonts` instead when you want a re-query.
        if (get().systemFontsLoaded)
            return;
        await runSystemFontEnumeration(set);
    },
    refreshSystemFonts: async () => {
        await runSystemFontEnumeration(set);
    },
}));
/**
 * Single source of truth for the queryLocalFonts → setState pipeline.
 * Shared between the initial load and the on-demand refresh path so
 * the fallback / failure handling stays consistent.
 */
const runSystemFontEnumeration = async (set) => {
    const finish = (families) => {
        set({ systemFonts: families, systemFontsLoaded: true });
    };
    if (typeof window.queryLocalFonts !== 'function') {
        finish(FALLBACK_SYSTEM_FONTS);
        return;
    }
    try {
        const fonts = await window.queryLocalFonts();
        const families = Array.from(new Set(fonts.map((f) => f.family).filter((f) => f.length > 0))).sort((a, b) => a.localeCompare(b));
        if (families.length === 0) {
            finish(FALLBACK_SYSTEM_FONTS);
            return;
        }
        finish(families);
    }
    catch (e) {
        // Permission denied, origin check failed, or the platform doesn't
        // expose the API. Fall back so the user can still pick a font.
        // eslint-disable-next-line no-console
        console.warn('[fonts] queryLocalFonts failed, using fallback list', e);
        finish(FALLBACK_SYSTEM_FONTS);
    }
};
/**
 * Merge project fonts + system fonts into one picker list. Project
 * fonts come first (the user actively added them) and shadow any
 * same-named system font, so the `Project` badge accurately reflects
 * the font source.
 */
export const selectAllFonts = (state) => {
    const result = [];
    const seen = new Set();
    for (const family of state.projectFonts) {
        const key = family.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({ family, source: 'project' });
    }
    for (const family of state.systemFonts) {
        const key = family.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({ family, source: 'system' });
    }
    return result;
};
