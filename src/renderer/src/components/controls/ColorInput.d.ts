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
};
export declare const ColorInput: ({ value, onChange, presetColors, tokens, onOpenTheme, }: Props) => JSX.Element;
export {};
