import { type PointerEvent } from 'react';
import type { CanvasGeometry, DrawState } from './types';
export type DrawInteraction = {
    draw: DrawState | null;
    /** Claim the gesture if a draw tool (rect/input/text/image) is active. */
    tryStart: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Update the in-progress draw rect; returns true if a draw is active. */
    onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Create the element from the drawn rect (or a click default) on release. */
    onEnd: () => void;
};
/**
 * Draw state machine for the rectangle / input / image tools, plus the
 * single-click text tool. Owns the `pendingImage` selection: activating
 * the image tool opens a file dialog, and once a file is chosen the
 * pointer drag draws the rect the image fills. A click (sub-threshold
 * drag) drops a default-sized element centered on the cursor.
 */
export declare const useDrawInteraction: (geometry: CanvasGeometry) => DrawInteraction;
