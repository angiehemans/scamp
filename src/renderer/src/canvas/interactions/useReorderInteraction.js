import { useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { commitReparentDrop, resolveReparentDrop } from './reparentDrop';
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
export const useReorderInteraction = (geometry) => {
    const [reorder, setReorder] = useState(null);
    const [dropIndicator, setDropIndicator] = useState(null);
    const [crossDrop, setCrossDrop] = useState(null);
    const elements = useCanvasStore((s) => s.elements);
    const reorderElement = useCanvasStore((s) => s.reorderElement);
    const reparentElement = useCanvasStore((s) => s.reparentElement);
    const start = (e, id, parentId) => {
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        const elRect = geometry.measureElementInFrame(id);
        const cursor = geometry.toFrame(e.clientX, e.clientY);
        setReorder({
            id,
            parentId,
            grabDX: elRect ? cursor.x - elRect.x : 0,
            grabDY: elRect ? cursor.y - elRect.y : 0,
        });
        setCrossDrop(null);
    };
    const onMove = (e) => {
        if (!reorder)
            return false;
        const el = elements[reorder.id];
        if (!el)
            return true;
        // A different container under the cursor turns this into a reparent.
        // Take priority over same-parent reordering and clear the gap line.
        // excludeSiblings: dragging over a sibling here means "reorder next to
        // it", not "nest into it".
        const drop = resolveReparentDrop(el, { dx: reorder.grabDX, dy: reorder.grabDY }, e.clientX, e.clientY, geometry, elements, true);
        if (drop) {
            setCrossDrop(drop);
            setDropIndicator(null);
            return true;
        }
        setCrossDrop(null);
        // Same-parent reorder: drop indicator + index from the sibling under
        // the cursor and which side of its centre.
        const parent = elements[reorder.parentId];
        if (!parent)
            return true;
        const siblingIds = parent.childIds.filter((id) => id !== reorder.id);
        let hitSiblingId = null;
        const candidates = document.elementsFromPoint(e.clientX, e.clientY);
        for (const node of candidates) {
            if (!(node instanceof HTMLElement))
                continue;
            const id = node.dataset['elementId'];
            if (id && siblingIds.includes(id)) {
                hitSiblingId = id;
                break;
            }
        }
        if (!hitSiblingId) {
            setDropIndicator(null);
            return true;
        }
        const siblingRect = geometry.measureElementInFrame(hitSiblingId);
        if (!siblingRect) {
            setDropIndicator(null);
            return true;
        }
        const isRow = parent.flexDirection === 'row';
        const { x: cursorX, y: cursorY } = geometry.toFrame(e.clientX, e.clientY);
        const before = isRow
            ? cursorX < siblingRect.x + siblingRect.w / 2
            : cursorY < siblingRect.y + siblingRect.h / 2;
        const siblingIdx = parent.childIds.indexOf(hitSiblingId);
        const newIndex = before ? siblingIdx : siblingIdx + 1;
        const LINE = 2;
        const indicatorRect = isRow
            ? {
                x: before
                    ? siblingRect.x - LINE / 2
                    : siblingRect.x + siblingRect.w - LINE / 2,
                y: siblingRect.y,
                w: LINE,
                h: siblingRect.h,
            }
            : {
                x: siblingRect.x,
                y: before
                    ? siblingRect.y - LINE / 2
                    : siblingRect.y + siblingRect.h - LINE / 2,
                w: siblingRect.w,
                h: LINE,
            };
        setDropIndicator({ rect: indicatorRect, newIndex });
        return true;
    };
    const onEnd = () => {
        if (reorder) {
            if (crossDrop) {
                commitReparentDrop(crossDrop, reorder.id, elements, reorderElement, reparentElement);
            }
            else if (dropIndicator) {
                // Same-parent reorder — parentId unchanged.
                reorderElement(reorder.id, reorder.parentId, dropIndicator.newIndex);
            }
            setReorder(null);
            setDropIndicator(null);
            setCrossDrop(null);
        }
    };
    return { dropIndicator, crossDrop, start, onMove, onEnd };
};
