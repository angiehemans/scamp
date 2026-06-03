import { type SpaceTuple } from '@lib/spaceValue';
import type { ThemeToken } from '@shared/types';
type Props = {
    value: SpaceTuple;
    onChange: (next: SpaceTuple) => void;
    /** Minimum allowed per-side numeric value (inclusive). Tokens
     *  bypass this — they're emitted verbatim. */
    min?: number;
    /** Inline prefix label shown inside the input (e.g. "P", "M"). */
    prefix?: string;
    /** Tooltip shown on hover. */
    title?: string;
    /** Length-shaped theme tokens to offer in the picker. Omit to hide
     *  the picker icon entirely. */
    tokens?: ReadonlyArray<ThemeToken>;
    /** Opens the Theme tokens panel from the empty-state row. */
    onOpenTheme?: () => void;
};
/**
 * A single text input for editing a [top, right, bottom, left] tuple using
 * CSS shorthand notation. Accepts 1–4 values separated by spaces or
 * commas. Each value can be a plain number, `Npx`, or a `var(--name)`
 * reference. Numbers and tokens can be mixed across sides.
 *
 * Invalid input reverts on blur via the PrefixSuffixInput value sync.
 */
export declare const FourSideInput: ({ value, onChange, min, prefix, title, tokens, onOpenTheme, }: Props) => JSX.Element;
export {};
