import { type PointerEvent, useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import type { ScampElement } from '@lib/element';

import type { CanvasGeometry, MoveState } from './types';

export type MoveInteraction = {
  move: MoveState | null;
  /** Begin a move drag for the given (non-flex, non-root) element. */
  start: (e: PointerEvent<HTMLDivElement>, id: string, el: ScampElement) => void;
  /** Apply the move while dragging; returns true if a move is active. */
  onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
  /** Commit the move transaction and clear state on pointer release. */
  onEnd: () => void;
};

/**
 * Move state machine for absolutely-positioned elements. A history
 * transaction wraps the per-tick `moveElement` calls so the drag commits
 * as a single `move` entry. Position is clamped to the parent's current
 * visible extent so an element can't be dragged off the page.
 */
export const useMoveInteraction = (
  geometry: CanvasGeometry,
  scale: number
): MoveInteraction => {
  const [move, setMove] = useState<MoveState | null>(null);
  const elements = useCanvasStore((s) => s.elements);
  const moveElement = useCanvasStore((s) => s.moveElement);

  const start = (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    el: ScampElement
  ): void => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

  const onMove = (e: PointerEvent<HTMLDivElement>): boolean => {
    if (!move) return false;
    const el = elements[move.id];
    if (!el) return true;
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

  const onEnd = (): void => {
    if (move) {
      // Close the move transaction — commits one `move` entry
      // covering the drag and drains any external edit that
      // arrived mid-drag.
      useHistoryStore
        .getState()
        .endHistoryTransaction(
          { kind: 'move', elementIds: [move.id] },
          useCanvasStore.getState().elements
        );
    }
    setMove(null);
  };

  return { move, start, onMove, onEnd };
};
