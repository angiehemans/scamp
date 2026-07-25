type Props = {
    /** "Columns" or "Rows" — heading + singular used in labels. */
    label: string;
    /** The raw `grid-template-columns` / `-rows` string. */
    template: string;
    /** Called with the next raw template string on any edit. */
    onChange: (next: string) => void;
};
/**
 * Collapsible per-track editor for one grid axis: a chip per track
 * (type + size), add/remove, and a proportional preview — tucked into
 * an accordion so a many-track grid stays compact. Falls back to a
 * plain text field when the template is too complex to model as a flat
 * track list (`parseGridTemplate` → null).
 */
export declare const GridTrackList: ({ label, template, onChange, }: Props) => JSX.Element;
export {};
