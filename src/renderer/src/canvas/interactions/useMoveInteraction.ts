import { type PointerEvent, useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { useAppLogStore } from '@store/appLogSlice';
import type { ScampElement } from '@lib/element';

import {
  commitReparentDrop,
  resolveReparentDrop,
  slotDropCreatesCycle,
} from './reparentDrop';
import type { CanvasGeometry, MoveState, ReparentDrop } from './types';

export type MoveInteraction = {
  move: MoveState | null;
  /** Pending cross-parent reparent (drives the drop feedback). */
  crossDrop: ReparentDrop | null;
  /** Begin a move drag for the given (non-flex, non-root) element. */
  start: (e: PointerEvent<HTMLDivElement>, id: string, el: ScampElement) => void;
  /** Apply the move while dragging; returns true if a move is active. */
  onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
  /** Commit the move (or reparent) transaction and clear state on release. */
  onEnd: () => void;
};

/**
 * Move state machine for absolutely-positioned elements. A history
 * transaction wraps the per-tick `moveElement` calls so the drag commits
 * as a single entry. Position is clamped to the parent's current visible
 * extent so an element can't be dragged off the page.
 *
 * While dragging, the cursor is hit-tested for a DIFFERENT container
 * (`resolveReparentDrop`). The element keeps following the cursor inside
 * its current parent AND the target gets drop feedback (gap line for
 * flex/grid, outline for absolute). On release over that target the
 * element is reparented — committed inside the same open transaction so
 * the whole gesture is one undo step.
 * see docs/plans/canvas-drag-reparent-plan.md
 */
export const useMoveInteraction = (
  geometry: CanvasGeometry,
  scale: number
): MoveInteraction => {
  const [move, setMove] = useState<MoveState | null>(null);
  const [crossDrop, setCrossDrop] = useState<ReparentDrop | null>(null);
  const elements = useCanvasStore((s) => s.elements);
  const moveElement = useCanvasStore((s) => s.moveElement);
  const reorderElement = useCanvasStore((s) => s.reorderElement);
  const reparentElement = useCanvasStore((s) => s.reparentElement);
  const setElementSlotName = useCanvasStore((s) => s.setElementSlotName);

  const start = (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    el: ScampElement
  ): void => {
    // Read-only while previewing a snapshot — no element moves.
    if (useCanvasStore.getState().snapshotPreview !== null) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
    setCrossDrop(null);
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

    // Resolve a reparent target under the cursor (different container).
    // Absolute elements don't reorder, so siblings are valid targets.
    setCrossDrop(
      resolveReparentDrop(
        el,
        { dx: move.grabDX, dy: move.grabDY },
        e.clientX,
        e.clientY,
        geometry,
        elements
      )
    );
    return true;
  };

  const onEnd = (): void => {
    if (move) {
      // Refuse a slot drop that would create a component cycle (only
      // reachable while editing a component). The element keeps the
      // position it was dragged to; the open transaction still closes as a
      // plain move so the gesture is one clean undo entry.
      const store = useCanvasStore.getState();
      const cycleRefused =
        crossDrop !== null &&
        slotDropCreatesCycle(
          crossDrop,
          move.id,
          elements,
          store.componentTrees,
          store.activeComponent?.name ?? null
        );
      if (cycleRefused) {
        const dragged = elements[move.id];
        useAppLogStore
          .getState()
          .log(
            'warn',
            `Refused: placing ${dragged?.componentName ?? 'component'} in a slot of ${store.activeComponent?.name ?? 'this component'} would create a cycle.`
          );
      }
      if (crossDrop && !cycleRefused) {
        // Reparent into the target. The action's own history commit
        // no-ops inside the open transaction; closing it below commits
        // one entry for the whole gesture.
        commitReparentDrop(
          crossDrop,
          move.id,
          elements,
          reorderElement,
          reparentElement
        );
        // Tag the reparented element with the slot it landed in (or clear
        // it when dropping into a normal container). Within the open
        // transaction, so it's part of the same undo entry.
        if (crossDrop.kind === 'absolute') {
          setElementSlotName(move.id, crossDrop.slotName);
        }
      }
      useHistoryStore
        .getState()
        .endHistoryTransaction(
          {
            kind: crossDrop && !cycleRefused ? 'reorder' : 'move',
            elementIds: [move.id],
          },
          useCanvasStore.getState().elements
        );
    }
    setMove(null);
    setCrossDrop(null);
  };

  return { move, crossDrop, start, onMove, onEnd };
};
