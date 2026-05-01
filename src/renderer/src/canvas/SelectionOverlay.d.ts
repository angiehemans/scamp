type Props = {
    x: number;
    y: number;
    width: number;
    height: number;
    /** When false, the resize handles are not rendered (e.g. for the page root). */
    showHandles?: boolean;
};
export declare const SelectionOverlay: ({ x, y, width, height, showHandles, }: Props) => JSX.Element;
export {};
