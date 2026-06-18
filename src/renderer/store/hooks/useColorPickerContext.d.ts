import type { ThemeToken } from '@shared/types';
/**
 * The three project-level inputs every section's color picker needs:
 * the project palette (as `presetColors`), the theme tokens, and the
 * theme-panel opener. Centralizes the triple `useCanvasStore` read +
 * the `length > 0 ? ... : undefined` palette normalization that
 * otherwise repeats verbatim in Border/Background/Typography/Shadows.
 *
 * `presetColors` is ready to hand to `<ColorInput presetColors>`;
 * `themeTokens` is the raw token list (sections that filter tokens by
 * category — e.g. Border's spacing tokens — derive from it);
 * `onOpenTheme` is normalized to `undefined` when no opener is set.
 */
export type ColorPickerContext = {
    presetColors: ReadonlyArray<string> | undefined;
    themeTokens: ReadonlyArray<ThemeToken>;
    onOpenTheme: (() => void) | undefined;
};
export declare const useColorPickerContext: () => ColorPickerContext;
