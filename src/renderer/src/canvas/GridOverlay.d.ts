type Props = {
    /** The selected grid container's `data-element-id`. */
    elementId: string;
    /**
     * The frame's getBoundingClientRect-derived rect in unscaled
     * coordinates — used to translate the absolute browser-coordinate
     * lines into frame-local positions for rendering.
     */
    frameRect: {
        left: number;
        top: number;
    };
    /** Frame scale factor — same value the interaction layer computes. */
    scale: number;
};
/**
 * Dashed-line overlay that visualises the column/row tracks of a grid
 * container. Lives outside the container itself (it renders next to
 * the SelectionOverlay so it's not affected by `overflow:hidden` on
 * the grid). Position is recomputed via getComputedStyle on every
 * canvas state change + ResizeObserver.
 */
export declare const GridOverlay: ({ elementId, frameRect, scale, }: Props) => JSX.Element | null;
export {};
