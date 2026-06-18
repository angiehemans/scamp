import { type PointerEvent } from 'react';
import type { CanvasGeometry } from './types';
export type ResizeInteraction = {
    /** Claim the gesture if a resize handle is under the cursor. */
    tryStart: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Apply the resize while dragging; returns true if a resize is active. */
    onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Commit the resize transaction and clear state on pointer release. */
    onEnd: () => void;
};
/**
 * Resize state machine. Handles sit on top of everything and take
 * precedence over the tools, but only when exactly one element is
 * selected. A history transaction wraps the per-tick `resizeElement`
 * calls so the whole drag commits as a single `resize` entry.
 */
export declare const useResizeInteraction: (geometry: CanvasGeometry, scale: number) => ResizeInteraction;
