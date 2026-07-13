import { type RefObject } from 'react';
/**
 * Floor on the canvas frame's rendered height. Purely a design-tool
 * convenience — the frame grows past this as content is added, but
 * this keeps an empty project looking like a blank page rather than
 * a thin strip. Also used by `ElementRenderer` as the root element's
 * canvas-only min-height so flex-column centering has vertical space
 * to distribute within.
 */
export declare const EMPTY_FRAME_MIN_HEIGHT = 900;
/**
 * Renders the canvas page-root inside a scaled frame. Does NOT own a
 * scroll container — the enclosing artboard scrolls, so the frame can
 * overflow in any direction and the element toolbar can float above
 * the scrolling content without being clipped.
 *
 * The frame's WIDTH comes from per-project config (`canvasWidth`),
 * not from the root element — canvas size is a design-tool concept
 * and never touches the CSS file. Height grows with content.
 *
 * Fit-to-width zoom observes the scroll container (passed in via
 * `scrollContainerRef`) to keep the frame comfortably inside the
 * visible artboard when `userZoom` is null.
 */
type Props = {
    /** Viewport width in logical pixels, from scamp.config.json. */
    canvasWidth: number;
    /**
     * Optional explicit canvas height in logical pixels. In the component
     * editor it's a MIN (the frame grows past it with content). For the
     * page canvas with `heightIsFixed`, it's an EXACT height.
     */
    canvasHeight?: number;
    /**
     * When true, `canvasHeight` is an exact frame height (page fixed-height
     * mode) rather than a minimum. The component editor leaves this false so
     * its canvas still grows with content past the configured height.
     */
    heightIsFixed?: boolean;
    /** When true, the frame clips content that extends outside its bounds. */
    clipContent: boolean;
    /** The artboard scroll container, used for fit-to-width measurement. */
    scrollContainerRef: RefObject<HTMLElement | null>;
    /**
     * Resize callback for the bottom-right drag handle. When
     * provided, the handle renders at the frame's BR corner;
     * dragging emits running (width, height) updates. The caller
     * (ProjectShell, for the component editor) writes the result
     * back into `projectConfig.componentCanvas`. Page mode omits
     * the prop so no handle renders.
     */
    onResize?: (width: number, height: number) => void;
};
export declare const Viewport: ({ canvasWidth, canvasHeight, heightIsFixed, clipContent, scrollContainerRef, onResize, }: Props) => JSX.Element;
export {};
