import { useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';
import { hasLeftClickSlop } from './constants';
import { commitReparentDrop, flowIndicator, resolveReparentDrop, slotDropCreatesCycle, } from './reparentDrop';
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
    /**
     * Latched once the pointer leaves the click slop. A ref, not state:
     * it changes mid-gesture and must not re-render the canvas on the
     * move that happens to cross the threshold.
     */
    const armed = useRef(false);
    const [dropIndicator, setDropIndicator] = useState(null);
    const [crossDrop, setCrossDrop] = useState(null);
    const elements = useCanvasStore((s) => s.elements);
    const reorderElement = useCanvasStore((s) => s.reorderElement);
    const reparentElement = useCanvasStore((s) => s.reparentElement);
    const setElementSlotName = useCanvasStore((s) => s.setElementSlotName);
    const start = (e, id, parentId) => {
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        const elRect = geometry.measureElementInFrame(id);
        const cursor = geometry.toFrame(e.clientX, e.clientY);
        armed.current = false;
        setReorder({
            id,
            parentId,
            pointerStartX: e.clientX,
            pointerStartY: e.clientY,
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
        // Selecting is not dragging: below the click slop this gesture owns
        // the pointer but resolves nothing. Latched, so dragging back toward
        // the origin can't disarm it. see docs/notes/click-vs-drag-slop.md
        if (!armed.current) {
            if (!hasLeftClickSlop(reorder.pointerStartX, reorder.pointerStartY, e.clientX, e.clientY)) {
                return true;
            }
            armed.current = true;
        }
        // A different container under the cursor turns this into a reparent.
        // Take priority over same-parent reordering and clear the gap line.
        // excludeSiblings: dragging over a sibling here means "reorder next to
        // it", not "nest into it".
        const drop = resolveReparentDrop(el, { dx: reorder.grabDX, dy: reorder.grabDY }, e.clientX, e.clientY, geometry, elements);
        if (drop) {
            setCrossDrop(drop);
            setDropIndicator(null);
            return true;
        }
        setCrossDrop(null);
        // Same-parent reorder: the same sibling/edge math the cross-parent
        // path uses, so a reorder and a reparent can't disagree about where
        // the line goes — and so grid parents behave like flex ones.
        const parent = elements[reorder.parentId];
        if (!parent)
            return true;
        setDropIndicator(flowIndicator(parent, reorder.id, e.clientX, e.clientY, geometry));
        return true;
    };
    const onEnd = () => {
        armed.current = false;
        if (reorder) {
            if (crossDrop) {
                // Refuse a slot drop that would create a component cycle (only
                // reachable while editing a component). Clear state, no commit.
                const store = useCanvasStore.getState();
                if (slotDropCreatesCycle(crossDrop, reorder.id, elements, store.componentTrees, store.activeComponent?.name ?? null)) {
                    const dragged = elements[reorder.id];
                    useAppLogStore
                        .getState()
                        .log('warn', `Refused: placing ${dragged?.componentName ?? 'component'} in a slot of ${store.activeComponent?.name ?? 'this component'} would create a cycle.`);
                    setReorder(null);
                    setDropIndicator(null);
                    setCrossDrop(null);
                    return;
                }
                commitReparentDrop(crossDrop, reorder.id, elements, reorderElement, reparentElement);
                // Tag / clear the slot the reparented element landed in.
                if (crossDrop.kind === 'absolute') {
                    setElementSlotName(reorder.id, crossDrop.slotName);
                }
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
    const cancel = () => {
        armed.current = false;
        // Nothing to undo: a reorder drag only tracks an indicator and
        // applies the move on release, so abandoning it is just forgetting.
        setReorder(null);
        setDropIndicator(null);
        setCrossDrop(null);
    };
    return {
        dropIndicator,
        crossDrop,
        start,
        onMove,
        onEnd,
        cancel,
        active: reorder !== null,
    };
};
