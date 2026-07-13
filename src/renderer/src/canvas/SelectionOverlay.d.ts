type Props = {
    x: number;
    y: number;
    width: number;
    height: number;
    /** When false, the resize handles are not rendered (e.g. for the page root). */
    showHandles?: boolean;
    /**
     * When true, the aspect ratio is locked: only the four corner handles
     * render (edge handles are disabled) and the lock badge shows its
     * linked state.
     */
    ratioLocked?: boolean;
    /**
     * Toggle the ratio lock. When provided (and `showHandles`), a small
     * chain-link badge renders just outside the top-left corner. Omitted
     * for selections that can't be resized (root, flex children).
     */
    onToggleLock?: () => void;
};
export declare const SelectionOverlay: ({ x, y, width, height, showHandles, ratioLocked, onToggleLock, }: Props) => JSX.Element;
export {};
