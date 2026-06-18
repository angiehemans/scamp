import { type PointerEvent, useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';

import type { CanvasGeometry, DropIndicator, ReorderState } from './types';

export type ReorderInteraction = {
  dropIndicator: DropIndicator | null;
  /** Begin a flex-sibling reorder drag for the given child. */
  start: (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    parentId: string
  ) => void;
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
export const useReorderInteraction = (
  geometry: CanvasGeometry
): ReorderInteraction => {
  const [reorder, setReorder] = useState<ReorderState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null
  );
  const elements = useCanvasStore((s) => s.elements);
  const reorderElement = useCanvasStore((s) => s.reorderElement);

  const start = (
    e: PointerEvent<HTMLDivElement>,
    id: string,
    parentId: string
  ): void => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setReorder({ id, parentId });
  };

  const onMove = (e: PointerEvent<HTMLDivElement>): boolean => {
    if (!reorder) return false;
    // Compute the drop indicator + target index based on which sibling
    // (if any) is under the cursor and which side of its center.
    const parent = elements[reorder.parentId];
    if (!parent) return true;
    const siblingIds = parent.childIds.filter((id) => id !== reorder.id);

    // Find the topmost sibling under the cursor via elementsFromPoint.
    let hitSiblingId: string | null = null;
    const candidates = document.elementsFromPoint(e.clientX, e.clientY);
    for (const node of candidates) {
      if (!(node instanceof HTMLElement)) continue;
      const id = node.dataset['elementId'];
      if (id && siblingIds.includes(id)) {
        hitSiblingId = id;
        break;
      }
    }

    if (!hitSiblingId) {
      // Cursor isn't over any sibling — clear the indicator. We could
      // also compute an "end of list" indicator but it's simpler to
      // require the user to drop on a sibling.
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

    // The drop index is the position in the parent's childIds where
    // the dragged element will end up AFTER its removal — exactly what
    // reorderElementPure expects.
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

  const onEnd = (): void => {
    if (reorder && dropIndicator) {
      // Commit the flex-sibling reorder. parentId stays the same — this
      // drag mode never re-parents.
      reorderElement(reorder.id, reorder.parentId, dropIndicator.newIndex);
    }
    if (reorder) {
      setReorder(null);
      setDropIndicator(null);
    }
  };

  return { dropIndicator, start, onMove, onEnd };
};
