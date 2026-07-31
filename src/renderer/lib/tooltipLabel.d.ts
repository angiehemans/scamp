/**
 * Tooltip strings across the app follow a `Name — description`
 * convention ("Height — type a number, or any CSS length"). Splitting
 * on that separator lets the Tooltip render the name as its header and
 * the rest as subdued body text, without every call site having to
 * pass a separate `header` prop.
 */
export type TooltipParts = {
    /** The field name, or `null` when the label has no header segment. */
    header: string | null;
    /** The remaining text — the whole label when there is no header. */
    body: string;
};
/**
 * Splits a tooltip label into its header and body on the first spaced
 * em dash. Returns `header: null` (and the label unchanged as `body`)
 * when there is no separator, when the leading segment is too long to
 * be a field name, or when either side would be empty.
 */
export declare const splitTooltipLabel: (label: string) => TooltipParts;
