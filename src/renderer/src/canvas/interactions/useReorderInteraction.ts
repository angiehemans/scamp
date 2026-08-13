import { type PointerEvent, useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { useAppLogStore } from '@store/appLogSlice';

import {
  commitReparentDrop,
  flowIndicator,
  resolveReparentDrop,
  slotDropCreatesCycle,
} from './reparentDrop';
import type {
  CanvasGeometry,
  DropIndicator,
  ReorderState,
  ReparentDrop,
} from './types';

export type ReorderInteraction = {
  dropIndicator: DropIndicator | null;
  /** Pending cross-parent reparent (different container under the cursor). */
  crossDrop: ReparentDrop | null;
  /** Begin a flex-sibling reorder drag for the given child. */
  start: (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    parentId: string
  ) => void;
  /** Track the drop target while dragging; returns true if active. */
  onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
  /** Commit the reorder / reparent (if a target is set) and clear state. */
  onEnd: () => void;
  /** Abandon the drag without applying anything. */
  cancel: () => void;
  /** True from pointer-down until release — set before any drop target
   *  resolves, so Escape works from the very start of the gesture. */
  active: boolean;
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
export const useReorderInteraction = (
  geometry: CanvasGeometry
): ReorderInteraction => {
  const [reorder, setReorder] = useState<ReorderState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null
  );
  const [crossDrop, setCrossDrop] = useState<ReparentDrop | null>(null);
  const elements = useCanvasStore((s) => s.elements);
  const reorderElement = useCanvasStore((s) => s.reorderElement);
  const reparentElement = useCanvasStore((s) => s.reparentElement);
  const setElementSlotName = useCanvasStore((s) => s.setElementSlotName);

  const start = (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    parentId: string
  ): void => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

  const onMove = (e: PointerEvent<HTMLDivElement>): boolean => {
    if (!reorder) return false;
    const el = elements[reorder.id];
    if (!el) return true;

    // A different container under the cursor turns this into a reparent.
    // Take priority over same-parent reordering and clear the gap line.
    // excludeSiblings: dragging over a sibling here means "reorder next to
    // it", not "nest into it".
    const drop = resolveReparentDrop(
      el,
      { dx: reorder.grabDX, dy: reorder.grabDY },
      e.clientX,
      e.clientY,
      geometry,
      elements
    );
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
    if (!parent) return true;
    setDropIndicator(
      flowIndicator(parent, reorder.id, e.clientX, e.clientY, geometry)
    );
    return true;
  };

  const onEnd = (): void => {
    if (reorder) {
      if (crossDrop) {
        // Refuse a slot drop that would create a component cycle (only
        // reachable while editing a component). Clear state, no commit.
        const store = useCanvasStore.getState();
        if (
          slotDropCreatesCycle(
            crossDrop,
            reorder.id,
            elements,
            store.componentTrees,
            store.activeComponent?.name ?? null
          )
        ) {
          const dragged = elements[reorder.id];
          useAppLogStore
            .getState()
            .log(
              'warn',
              `Refused: placing ${dragged?.componentName ?? 'component'} in a slot of ${store.activeComponent?.name ?? 'this component'} would create a cycle.`
            );
          setReorder(null);
          setDropIndicator(null);
          setCrossDrop(null);
          return;
        }
        commitReparentDrop(
          crossDrop,
          reorder.id,
          elements,
          reorderElement,
          reparentElement
        );
        // Tag / clear the slot the reparented element landed in.
        if (crossDrop.kind === 'absolute') {
          setElementSlotName(reorder.id, crossDrop.slotName);
        }
      } else if (dropIndicator) {
        // Same-parent reorder — parentId unchanged.
        reorderElement(reorder.id, reorder.parentId, dropIndicator.newIndex);
      }
      setReorder(null);
      setDropIndicator(null);
      setCrossDrop(null);
    }
  };

  const cancel = (): void => {
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
