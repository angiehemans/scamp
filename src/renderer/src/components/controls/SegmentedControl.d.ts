import type { ReactNode } from 'react';
type Option<V extends string> = {
    value: V;
    label: ReactNode;
    /** Optional per-option tooltip. When set, the button is wrapped in
     * Tooltip so each segment can describe its effect individually. */
    tooltip?: string;
    /** Optional aria-label override — required when `label` is a
     * non-text ReactNode (icon-only buttons) so the button has an
     * accessible name. Falls back to `tooltip` when omitted, or the
     * string value of `label` if it happens to be a plain string. */
    ariaLabel?: string;
};
type Props<V extends string> = {
    value: V;
    options: ReadonlyArray<Option<V>>;
    onChange: (value: V) => void;
    /** Tooltip shown on hover of the whole group. Mutually useful with
     * per-option tooltips — the group-level tooltip describes the axis,
     * per-option tooltips describe each segment. */
    title?: string;
};
export declare const SegmentedControl: <V extends string>({ value, options, onChange, title, }: Props<V>) => JSX.Element;
export {};
