type Props = {
    columns: string;
    rows: string;
    onChange: (patch: {
        gridTemplateColumns?: string;
        gridTemplateRows?: string;
    }) => void;
};
/**
 * Visual builder for `grid-template-columns` / `-rows`. A quick N×M
 * matrix picker seeds the grid with equal `fr` tracks; the per-axis
 * track lists then tune each track (size + type, add/remove). The
 * store keeps the raw CSS strings — this is only an editing lens (see
 * `@lib/gridTemplate`).
 */
export declare const GridTemplateEditor: ({ columns, rows, onChange, }: Props) => JSX.Element;
export {};
