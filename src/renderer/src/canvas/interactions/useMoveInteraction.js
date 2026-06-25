import { useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
/**
 * Move state machine for absolutely-positioned elements. A history
 * transaction wraps the per-tick `moveElement` calls so the drag commits
 * as a single entry. Position is clamped to the parent's current visible
 * extent so an element can't be dragged off the page.
 *
 * While dragging, the cursor is hit-tested for a different ABSOLUTE
 * container (`resolveDropContainer`); when one is found the element keeps
 * following the cursor inside its current parent AND the target container
 * is highlighted. On release over that target the element is reparented
 * and placed at the cursor point in the target's local space — committed
 * inside the same open transaction so it's a single undo step.
 * Flow (flex/grid) targets are handled in a later phase.
 * see docs/plans/canvas-drag-reparent-plan.md
 */
export const useMoveInteraction = (geometry, scale) => {
    const [move, setMove] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const elements = useCanvasStore((s) => s.elements);
    const moveElement = useCanvasStore((s) => s.moveElement);
    const reparentElement = useCanvasStore((s) => s.reparentElement);
    const start = (e, id, el) => {
        // Read-only while previewing a snapshot — no element moves.
        if (useCanvasStore.getState().snapshotPreview !== null)
            return;
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        // Open a history transaction so per-tick `moveElement` calls
        // during the drag coalesce into a single entry on release.
        useHistoryStore.getState().beginHistoryTransaction();
        // Capture where on the element the cursor grabbed (frame-local), so a
        // reparent can keep the element under the cursor on drop.
        const elRect = geometry.measureElementInFrame(id);
        const cursor = geometry.toFrame(e.clientX, e.clientY);
        setMove({
            id,
            pointerStartX: e.clientX,
            pointerStartY: e.clientY,
            originX: el.x,
            originY: el.y,
            grabDX: elRect ? cursor.x - elRect.x : 0,
            grabDY: elRect ? cursor.y - elRect.y : 0,
        });
        setDropTarget(null);
    };
    const onMove = (e) => {
        if (!move)
            return false;
        const el = elements[move.id];
        if (!el)
            return true;
        const parent = geometry.parentMoveBoundsOf(el.parentId);
        const dx = (e.clientX - move.pointerStartX) / scale;
        const dy = (e.clientY - move.pointerStartY) / scale;
        const proposedX = move.originX + dx;
        const proposedY = move.originY + dy;
        // Move-only clamp: width/height don't change, just keep the rect
        // fully inside the parent box.
        const clampedX = Math.max(0, Math.min(proposedX, parent.w - el.widthValue));
        const clampedY = Math.max(0, Math.min(proposedY, parent.h - el.heightValue));
        moveElement(move.id, Math.round(clampedX), Math.round(clampedY));
        // Resolve a reparent target under the cursor. Decision (b): reparent
        // only when the target differs from the current parent. Phase 2 covers
        // ABSOLUTE targets only — flow (flex/grid) drops are a later phase, so
        // ignore them here and behave as a normal move.
        const drop = geometry.resolveDropContainer(e.clientX, e.clientY, move.id);
        if (drop && !drop.isFlow && drop.parentId !== el.parentId) {
            const rect = geometry.measureElementInFrame(drop.parentId);
            if (rect) {
                const cursor = geometry.toFrame(e.clientX, e.clientY);
                const localX = cursor.x - rect.x - move.grabDX;
                const localY = cursor.y - rect.y - move.grabDY;
                const placedX = Math.max(0, Math.min(localX, rect.w - el.widthValue));
                const placedY = Math.max(0, Math.min(localY, rect.h - el.heightValue));
                setDropTarget({
                    id: drop.parentId,
                    rect,
                    x: Math.round(placedX),
                    y: Math.round(placedY),
                });
                return true;
            }
        }
        setDropTarget(null);
        return true;
    };
    const onEnd = () => {
        if (move) {
            if (dropTarget) {
                // Reparent into the absolute container at the cursor point. The
                // action's own history commit no-ops inside the open transaction;
                // closing the transaction below commits one entry for the gesture.
                const target = elements[dropTarget.id];
                const index = target ? target.childIds.length : 0;
                reparentElement(move.id, dropTarget.id, index, {
                    x: dropTarget.x,
                    y: dropTarget.y,
                });
            }
            useHistoryStore
                .getState()
                .endHistoryTransaction({ kind: dropTarget ? 'reorder' : 'move', elementIds: [move.id] }, useCanvasStore.getState().elements);
        }
        setMove(null);
        setDropTarget(null);
    };
    return { move, dropTarget, start, onMove, onEnd };
};
