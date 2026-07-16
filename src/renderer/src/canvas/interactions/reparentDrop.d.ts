import type { ScampElement } from '@lib/element';
import type { CanvasGeometry, ReparentDrop } from './types';
type ComponentTree = {
    elements: Record<string, ScampElement>;
    rootId: string;
};
/**
 * True when committing this slot drop would create a component cycle. Only
 * an absolute drop whose target is a component-instance is a slot drop, and
 * only a dragged component-instance can introduce a reference. The cycle is
 * checked against the component currently being edited (`activeComponentName`)
 * — dropping into a slot while editing component A folds the dragged
 * component into A's definition; if it transitively uses A, that's a cycle.
 * On a page (`activeComponentName` null) this is always false.
 * see docs/notes/components-multi-file-ops.md
 */
export declare const slotDropCreatesCycle: (drop: ReparentDrop, draggedId: string, elements: Record<string, ScampElement>, componentTrees: Record<string, ComponentTree>, activeComponentName: string | null) => boolean;
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
}, clientX: number, clientY: number, geometry: CanvasGeometry, elements: Record<string, ScampElement>) => ReparentDrop | null;
/**
 * Commit a resolved reparent. Flow targets reorder into the destination
 * at the computed index (layout owns position); absolute targets reparent
 * with the drop position appended to the container's children.
 */
export declare const commitReparentDrop: (drop: ReparentDrop, draggedId: string, elements: Record<string, ScampElement>, reorderElement: (id: string, parentId: string, index: number) => void, reparentElement: (id: string, parentId: string, index: number, pos?: {
    x: number;
    y: number;
}) => void) => void;
export {};
