import type { ThemeToken } from '@shared/types';
type Props = {
    value: string;
    onChange: (value: string) => void;
    /** Override preset color swatches (e.g. with project-derived colors). */
    presetColors?: ReadonlyArray<string>;
    /** Theme tokens — shown in the Tokens tab of the popover. */
    tokens?: ReadonlyArray<ThemeToken>;
    /** Called when the user clicks "Add Token" from the empty tokens tab. */
    onOpenTheme?: () => void;
    /**
     * When true, hides the SketchPicker's alpha slider so the popover
     * picks an opaque color only. The text input still accepts any
     * CSS color string. Used by sections (e.g. Shadows) that surface
     * opacity as a separate control to keep the two axes from racing.
     */
    disableAlpha?: boolean;
};
export declare const ColorInput: ({ value, onChange, presetColors, tokens, onOpenTheme, disableAlpha, }: Props) => JSX.Element;
export {};
