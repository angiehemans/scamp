type Option<V extends string> = {
    value: V;
    label: string;
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
