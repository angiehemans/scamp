import { useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
/**
 * Move state machine for absolutely-positioned elements. A history
 * transaction wraps the per-tick `moveElement` calls so the drag commits
 * as a single `move` entry. Position is clamped to the parent's current
 * visible extent so an element can't be dragged off the page.
 */
export const useMoveInteraction = (geometry, scale) => {
    const [move, setMove] = useState(null);
    const elements = useCanvasStore((s) => s.elements);
    const moveElement = useCanvasStore((s) => s.moveElement);
    const start = (e, id, el) => {
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        // Open a history transaction so per-tick `moveElement` calls
        // during the drag coalesce into a single `move` entry on
        // pointer release.
        useHistoryStore.getState().beginHistoryTransaction();
        setMove({
            id,
            pointerStartX: e.clientX,
            pointerStartY: e.clientY,
            originX: el.x,
            originY: el.y,
        });
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
        return true;
    };
    const onEnd = () => {
        if (move) {
            // Close the move transaction — commits one `move` entry
            // covering the drag and drains any external edit that
            // arrived mid-drag.
            useHistoryStore
                .getState()
                .endHistoryTransaction({ kind: 'move', elementIds: [move.id] }, useCanvasStore.getState().elements);
        }
        setMove(null);
    };
    return { move, start, onMove, onEnd };
};
