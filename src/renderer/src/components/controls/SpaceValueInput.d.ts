import { type SpaceValue } from '@lib/spaceValue';
import type { ThemeToken } from '@shared/types';
type Props = {
    value: SpaceValue;
    onChange: (next: SpaceValue) => void;
    /** Minimum allowed numeric value. Tokens bypass this clamp. */
    min?: number;
    /** Inline prefix (e.g. "Gap", "C-gap"). */
    prefix?: string;
    /** Tooltip on hover. */
    title?: string;
    /** Length-shaped theme tokens to offer in the picker. Omit to hide. */
    tokens?: ReadonlyArray<ThemeToken>;
    /** Opens the Theme tokens panel from the empty-state row. */
    onOpenTheme?: () => void;
};
/**
 * Single-value sibling of `FourSideInput`. Used for `gap`,
 * `column-gap`, `row-gap` — typed as `SpaceValue` (px number or
 * `var(--token)`). Renders an optional token-picker icon on the
 * right that, when clicked, lets the user apply a project spacing
 * token without dropping into raw CSS.
 *
 * Mirrors the visual + interaction model of `FourSideInput` so all
 * spacing-typed controls behave consistently.
 */
export declare const SpaceValueInput: ({ value, onChange, min, prefix, title, tokens, onOpenTheme, }: Props) => JSX.Element;
export {};
