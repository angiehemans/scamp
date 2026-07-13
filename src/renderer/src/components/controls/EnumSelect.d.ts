type Option<V extends string> = {
    value: V;
    label: string;
    /**
     * When true the option renders greyed and unselectable. The currently
     * selected value still displays even if disabled (native `<select>`
     * shows the matching option regardless), so callers can disable a mode
     * without breaking an element that already uses it.
     */
    disabled?: boolean;
};
type Props<V extends string> = {
    value: V;
    options: ReadonlyArray<Option<V>>;
    onChange: (value: V) => void;
    /** Tooltip shown on hover. */
    title?: string;
};
export declare const EnumSelect: <V extends string>({ value, options, onChange, title, }: Props<V>) => JSX.Element;
export {};
