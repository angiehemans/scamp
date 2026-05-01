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
    /**
     * Re-run the local-font enumeration regardless of whether the
     * initial load already happened. The font picker calls this each
     * time it opens so a font installed AFTER app start still shows
     * up without restarting Scamp.
     */
    refreshSystemFonts: () => Promise<void>;
    setProjectFonts: (input: {
        families: ReadonlyArray<string>;
        urls: ReadonlyArray<string>;
    }) => void;
};
export declare const useFontsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<FontsState>>;
/**
 * Merge project fonts + system fonts into one picker list. Project
 * fonts come first (the user actively added them) and shadow any
 * same-named system font, so the `Project` badge accurately reflects
 * the font source.
 */
export declare const selectAllFonts: (state: FontsState) => ReadonlyArray<AvailableFont>;
export {};
