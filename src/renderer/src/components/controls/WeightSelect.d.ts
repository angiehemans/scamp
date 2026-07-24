type Props = {
    /** Current weight as a string, e.g. "400". */
    value: string;
    onChange: (value: string) => void;
    /** Tooltip on the whole control. */
    title?: string;
};
/**
 * Editable weight combobox: pick a named weight (100 Thin … 900 Black) from
 * the dropdown, or type any value (e.g. 350 for a variable font). Emits the
 * committed weight as a string; the caller decides how to store it.
 */
export declare const WeightSelect: ({ value, onChange, title, }: Props) => JSX.Element;
export {};
