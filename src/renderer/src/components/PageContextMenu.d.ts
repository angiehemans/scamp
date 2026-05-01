export type PageMenuItem = {
    label: string;
    onSelect: () => void;
    /** Disables the item (grey, non-clickable). */
    disabled?: boolean;
    /** Styles the item red to signal a destructive action. */
    destructive?: boolean;
};
type Props = {
    x: number;
    y: number;
    items: ReadonlyArray<PageMenuItem>;
    onClose: () => void;
};
/**
 * Small floating context menu anchored at a viewport (x, y). Closes on
 * outside click, Escape, or after an item is chosen.
 */
export declare const PageContextMenu: ({ x, y, items, onClose }: Props) => JSX.Element;
export {};
