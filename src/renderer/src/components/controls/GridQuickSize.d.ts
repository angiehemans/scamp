type Props = {
    /** Grid extent offered in the picker. */
    maxCols?: number;
    maxRows?: number;
    /** The element's current track counts — highlighted when not hovering
     *  so the chosen size persists until changed. 0 = nothing selected. */
    selectedCols?: number;
    selectedRows?: number;
    /** Called with 1-based column/row counts when a cell is clicked. */
    onPick: (cols: number, rows: number) => void;
};
/**
 * A hover-to-size N×M matrix (Notion / Figma "insert table" style).
 * Hovering highlights the rectangle from the top-left to the hovered
 * cell; clicking commits that many columns × rows. With no hover, the
 * element's current dimensions stay highlighted.
 */
export declare const GridQuickSize: ({ maxCols, maxRows, selectedCols, selectedRows, onPick, }: Props) => JSX.Element;
export {};
