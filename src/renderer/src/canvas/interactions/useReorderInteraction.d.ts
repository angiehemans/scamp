import { type PointerEvent } from 'react';
import type { CanvasGeometry, DropIndicator, ReparentDrop } from './types';
export type ReorderInteraction = {
    dropIndicator: DropIndicator | null;
    /** Pending cross-parent reparent (different container under the cursor). */
    crossDrop: ReparentDrop | null;
    /** Begin a flex-sibling reorder drag for the given child. */
    start: (e: PointerEvent<HTMLDivElement>, id: string, parentId: string) => void;
    /** Track the drop target while dragging; returns true if active. */
    onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Commit the reorder / reparent (if a target is set) and clear state. */
    onEnd: () => void;
};
/**
 * Reorder state machine for flex children. Flex layout owns the child's
 * position, so within its own parent the only meaningful drag is moving it
 * in the sibling order (`dropIndicator` gap line → `reorderElement`).
 *
 * When the cursor moves over a DIFFERENT container, the drag becomes a
 * reparent (`resolveReparentDrop`): into another flex/grid container at an
 * insert index, or out into an absolute container at the cursor point.
 * This is what makes "drag a flex child into another container" work — the
 * case that previously read as "won't drag."
 * see docs/plans/canvas-drag-reparent-plan.md
 */
export declare const useReorderInteraction: (geometry: CanvasGeometry) => ReorderInteraction;
