import { type PointerEvent } from 'react';
import type { CanvasGeometry, DropIndicator } from './types';
export type ReorderInteraction = {
    dropIndicator: DropIndicator | null;
    /** Begin a flex-sibling reorder drag for the given child. */
    start: (e: PointerEvent<HTMLDivElement>, id: string, parentId: string) => void;
    /** Track the drop target while dragging; returns true if active. */
    onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Commit the reorder (if a drop target is set) and clear state. */
    onEnd: () => void;
};
/**
 * Reorder state machine for flex children. Flex layout owns the child's
 * position, so the only meaningful drag is moving it within the parent's
 * sibling order. `onMove` resolves the drop index + indicator rect from
 * whichever sibling is under the cursor; `onEnd` commits via
 * `reorderElement` (parent never changes — this mode doesn't re-parent).
 */
export declare const useReorderInteraction: (geometry: CanvasGeometry) => ReorderInteraction;
