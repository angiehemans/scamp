type FourSideValue = [number, number, number, number];
type Props = {
    value: FourSideValue;
    onChange: (next: FourSideValue) => void;
    /** Minimum allowed per-side value (inclusive). */
    min?: number;
    /** Inline prefix label shown inside the input (e.g. "P", "M", "W"). */
    prefix?: string;
    /** Tooltip shown on hover. */
    title?: string;
};
/**
 * A single text input for editing a [top, right, bottom, left] tuple using
 * CSS shorthand notation. Accepts 1–4 values separated by spaces or commas.
 *
 * Invalid input reverts on blur via the PrefixSuffixInput value sync.
 */
export declare const FourSideInput: ({ value, onChange, min, prefix, title, }: Props) => JSX.Element;
export {};
