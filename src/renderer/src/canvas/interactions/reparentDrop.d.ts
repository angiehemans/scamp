import type { ScampElement } from '@lib/element';
import type { CanvasGeometry, ReparentDrop } from './types';
/**
 * Resolve a pending reparent for the dragged element under the cursor, or
 * null when there's no valid DIFFERENT container (decision (b): reparent
 * only when the target differs from the current parent). `grab` is the
 * frame-local offset of the cursor within the dragged element, used to
 * keep the element under the cursor when dropping into an absolute parent.
 */
export declare const resolveReparentDrop: (draggedEl: ScampElement, grab: {
    dx: number;
    dy: number;
}, clientX: number, clientY: number, geometry: CanvasGeometry, elements: Record<string, ScampElement>, excludeSiblings: boolean) => ReparentDrop | null;
/**
 * Commit a resolved reparent. Flow targets reorder into the destination
 * at the computed index (layout owns position); absolute targets reparent
 * with the drop position appended to the container's children.
 */
export declare const commitReparentDrop: (drop: ReparentDrop, draggedId: string, elements: Record<string, ScampElement>, reorderElement: (id: string, parentId: string, index: number) => void, reparentElement: (id: string, parentId: string, index: number, pos?: {
    x: number;
    y: number;
}) => void) => void;
