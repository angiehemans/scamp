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
    /** When true, the frame clips content that extends outside its width. */
    canvasOverflowHidden: boolean;
    /** The artboard scroll container, used for fit-to-width measurement. */
    scrollContainerRef: RefObject<HTMLElement | null>;
};
export declare const Viewport: ({ canvasWidth, canvasOverflowHidden, scrollContainerRef, }: Props) => JSX.Element;
export {};
