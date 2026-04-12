import { PointerEvent, RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawPreview } from './DrawPreview';
import styles from './CanvasInteractionLayer.module.css';

type Props = {
  frameRef: RefObject<HTMLDivElement>;
  scale: number;
};

type DrawState = {
  parentId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  // Where the parent's top-left sits in frame coordinates so we can render
  // the preview at the right place.
  parentOffsetX: number;
  parentOffsetY: number;
};

type MoveState = {
  id: string;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
};

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type ResizeState = {
  id: string;
  handle: ResizeHandle;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
  originW: number;
  originH: number;
};

/**
 * Pointer state used when dragging a flex child to a new position in its
 * parent's flex flow. Position is owned by the layout engine, not by x/y,
 * so the only meaningful drag operation is reordering siblings.
 */
type ReorderState = {
  id: string;
  parentId: string;
};

type DropIndicator = {
  /** Frame-local rect to draw the drop line. */
  rect: { x: number; y: number; w: number; h: number };
  /** The childIds index the drop will resolve to on release. */
  newIndex: number;
};

const MIN_SIZE = 20;

/**
 * If the user just clicks (rather than drag-drawing) with the rectangle
 * tool, we drop a default-sized rect centered on the cursor. Anything
 * smaller than `CLICK_DRAG_THRESHOLD` on either axis counts as "click,
 * not drag".
 */
const CLICK_DRAG_THRESHOLD = 5;
const DEFAULT_NEW_RECT_SIZE = 200;

/**
 * Clamp a candidate (x, y, w, h) rect so it stays inside (parentW, parentH).
 *
 * Used by move, resize, and draw to enforce "children can't escape their
 * parent". The rect is shrunk before being shifted, so a rect that's too
 * big for the parent ends up flush at (0, 0) with size = parent size, not
 * outside the bounds.
 */
const clampToParent = (
  x: number,
  y: number,
  w: number,
  h: number,
  parentW: number,
  parentH: number
): { x: number; y: number; w: number; h: number } => {
  let nw = Math.max(MIN_SIZE, w);
  let nh = Math.max(MIN_SIZE, h);
  let nx = x;
  let ny = y;

  // If the rect's left/top is outside the parent, shift it back and
  // shrink the corresponding dimension so the opposite edge stays put.
  if (nx < 0) {
    nw = Math.max(MIN_SIZE, nw + nx);
    nx = 0;
  }
  if (ny < 0) {
    nh = Math.max(MIN_SIZE, nh + ny);
    ny = 0;
  }

  // Shrink to fit if the right/bottom edge spills past the parent.
  if (nx + nw > parentW) {
    nw = Math.max(MIN_SIZE, parentW - nx);
  }
  if (ny + nh > parentH) {
    nh = Math.max(MIN_SIZE, parentH - ny);
  }

  // Final pull-back: if the parent itself is smaller than MIN_SIZE we
  // can still spill — pull x/y in so the rect at least starts inside.
  if (nx + nw > parentW) nx = Math.max(0, parentW - nw);
  if (ny + nh > parentH) ny = Math.max(0, parentH - nh);

  return { x: nx, y: ny, w: nw, h: nh };
};

/**
 * Hit-test the cursor against existing elements. Returns the deepest
 * `data-element-id` under the point. We rely on `document.elementsFromPoint`
 * rather than maintaining a parallel quadtree — the canvas DOM is small
 * and React's render is the source of truth.
 */
const hitTest = (clientX: number, clientY: number): string | null => {
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const node of candidates) {
    if (node instanceof HTMLElement) {
      const id = node.dataset['elementId'];
      if (id) return id;
    }
  }
  return null;
};

const isResizeHandle = (clientX: number, clientY: number): ResizeHandle | null => {
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const node of candidates) {
    if (node instanceof HTMLElement && node.dataset['handle']) {
      return node.dataset['handle'] as ResizeHandle;
    }
  }
  return null;
};

type SelectedRect = { x: number; y: number; w: number; h: number };

export const CanvasInteractionLayer = ({ frameRef, scale }: Props): JSX.Element => {
  const layerRef = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [move, setMove] = useState<MoveState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [reorder, setReorder] = useState<ReorderState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  // The selected element's bounding box, measured straight from the DOM in
  // frame-local (unscaled) coordinates. We measure rather than compute from
  // `el.x/el.y` so the overlay matches the rendered position exactly even
  // when layout quirks (padding, borders, flex flow) shift the element off
  // its stored coordinates.
  const [selectedRect, setSelectedRect] = useState<SelectedRect | null>(null);

  const activeTool = useCanvasStore((s) => s.activeTool);
  const elements = useCanvasStore((s) => s.elements);
  // The "primary" selection — used for resize-handle positioning, drag-to-
  // move, and as the focus of the properties panel. Multi-select highlights
  // are handled per-element via ElementRenderer.
  const selectedElementIds = useCanvasStore((s) => s.selectedElementIds);
  const selectedElementId = selectedElementIds[0] ?? null;
  const isSingleSelection = selectedElementIds.length === 1;
  const editingElementId = useCanvasStore((s) => s.editingElementId);
  const selectElement = useCanvasStore((s) => s.selectElement);
  const toggleSelectElement = useCanvasStore((s) => s.toggleSelectElement);
  const setTool = useCanvasStore((s) => s.setTool);
  const createRectangle = useCanvasStore((s) => s.createRectangle);
  const createText = useCanvasStore((s) => s.createText);
  const setEditingElement = useCanvasStore((s) => s.setEditingElement);
  const moveElement = useCanvasStore((s) => s.moveElement);
  const resizeElement = useCanvasStore((s) => s.resizeElement);
  const reorderElement = useCanvasStore((s) => s.reorderElement);

  /**
   * Convert page-space pointer coords to frame-local coords.
   *
   * CSS `zoom` (unlike `transform: scale`) creates a new coordinate
   * context — getBoundingClientRect() for children of a zoomed element
   * returns values that already account for the zoom. Since everything
   * in the interaction layer is a child of the zoomed frame, we do NOT
   * divide by scale.
   */
  const toFrame = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  /**
   * Measure an element's bounding box in frame-local coordinates by
   * querying the actual rendered DOM. Source of truth for the selection
   * overlay and the draw-tool parent offset.
   *
   * With CSS `zoom` on the frame, both the element and the frame rects
   * from getBoundingClientRect are in viewport pixels (zoomed). The
   * difference gives the zoomed pixel offset; dividing by zoom recovers
   * frame-local coordinates. The overlay is also a child of the zoomed
   * frame, so positioning it at these frame-local values is correct.
   */
  const measureElementInFrame = (id: string): SelectedRect | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const node = frame.querySelector(`[data-element-id="${id}"]`);
    if (!(node instanceof HTMLElement)) return null;

    // With CSS `zoom` on the frame, use offsetLeft/offsetTop to walk up
    // to the frame boundary. Unlike getBoundingClientRect(), offset
    // properties are always in the element's own coordinate space and
    // are not affected by ancestor zoom — so no division by scale is
    // needed. The overlay is a child of the zoomed frame too, so these
    // frame-local coords position it correctly.
    let x = 0;
    let y = 0;
    let current: HTMLElement | null = node;
    while (current && current !== frame) {
      x += current.offsetLeft;
      y += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    return {
      x,
      y,
      w: node.offsetWidth,
      h: node.offsetHeight,
    };
  };

  /** Look up a parent element's inner-bounds size, falling back to root. */
  const parentSizeOf = (parentId: string | null): { w: number; h: number } => {
    const id = parentId ?? ROOT_ELEMENT_ID;
    const el = elements[id];
    if (!el) return { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY };
    return { w: el.widthValue, h: el.heightValue };
  };

  /** True if `el`'s parent is a flex container — i.e. flex layout owns its position. */
  const isFlexChild = (el: ScampElement | undefined): boolean => {
    if (!el || !el.parentId) return false;
    return elements[el.parentId]?.display === 'flex';
  };

  // Re-measure the selected element from the DOM whenever anything that
  // could move it changes. useLayoutEffect runs after layout/render but
  // before paint, so the overlay never visibly lags the element.
  useLayoutEffect(() => {
    if (!selectedElementId) {
      setSelectedRect(null);
      return;
    }
    setSelectedRect(measureElementInFrame(selectedElementId));
    // We deliberately depend on `elements` so any change to the canvas
    // (move, resize, panel edit, file reload) re-measures the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementId, elements, scale]);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = isResizeHandle(e.clientX, e.clientY);

    // Resize takes precedence — handles sit on top of everything. Only
    // active when exactly one element is selected (we don't show handles
    // for multi-select).
    if (handle && selectedElementId && isSingleSelection) {
      const el = elements[selectedElementId];
      if (!el) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      setResize({
        id: selectedElementId,
        handle,
        pointerStartX: e.clientX,
        pointerStartY: e.clientY,
        originX: el.x,
        originY: el.y,
        originW: el.widthValue,
        originH: el.heightValue,
      });
      return;
    }

    if (activeTool === 'rectangle') {
      const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
      const parentRect = measureElementInFrame(hitId) ?? { x: 0, y: 0, w: 0, h: 0 };
      const { x, y } = toFrame(e.clientX, e.clientY);
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      setDraw({
        parentId: hitId,
        startX: x - parentRect.x,
        startY: y - parentRect.y,
        currentX: x - parentRect.x,
        currentY: y - parentRect.y,
        parentOffsetX: parentRect.x,
        parentOffsetY: parentRect.y,
      });
      return;
    }

    if (activeTool === 'text') {
      const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
      const parentRect = measureElementInFrame(hitId) ?? { x: 0, y: 0, w: 0, h: 0 };
      const { x, y } = toFrame(e.clientX, e.clientY);
      const parent = parentSizeOf(hitId);
      // Default text size from canvasSlice — keep in sync with `makeText`.
      const TEXT_W = 120;
      const TEXT_H = 24;
      const localX = x - parentRect.x;
      const localY = y - parentRect.y;
      const clampedX = Math.max(0, Math.min(localX, parent.w - TEXT_W));
      const clampedY = Math.max(0, Math.min(localY, parent.h - TEXT_H));
      e.preventDefault();
      createText({
        parentId: hitId,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
      });
      setTool('select');
      return;
    }

    // Select tool
    const hitId = hitTest(e.clientX, e.clientY);
    if (!hitId) {
      // Plain click on empty canvas clears selection. Shift+click never
      // clears so the user can keep building up a multi-select set.
      if (!e.shiftKey) selectElement(null);
      return;
    }
    if (e.shiftKey) {
      toggleSelectElement(hitId);
      return;
    }
    selectElement(hitId);
    const el = elements[hitId];
    if (!el) return;
    // The root element is selectable (so the user can edit page-level
    // styles in the panel) but not draggable — moving the page frame
    // around would be meaningless.
    if (hitId === ROOT_ELEMENT_ID) {
      return;
    }
    // Flex children can't be moved by x/y, but they CAN be reordered
    // within their parent's flex flow. Enter the reorder drag state and
    // let pointermove figure out where in the sibling list the drop will
    // land.
    if (isFlexChild(el) && el.parentId) {
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      setReorder({ id: hitId, parentId: el.parentId });
      return;
    }
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    setMove({
      id: hitId,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originX: el.x,
      originY: el.y,
    });
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (draw) {
      const { x, y } = toFrame(e.clientX, e.clientY);
      setDraw({
        ...draw,
        currentX: x - draw.parentOffsetX,
        currentY: y - draw.parentOffsetY,
      });
      return;
    }
    if (move) {
      const el = elements[move.id];
      if (!el) return;
      const parent = parentSizeOf(el.parentId);
      const dx = (e.clientX - move.pointerStartX) / scale;
      const dy = (e.clientY - move.pointerStartY) / scale;
      const proposedX = move.originX + dx;
      const proposedY = move.originY + dy;
      // Move-only clamp: width/height don't change, just keep the rect
      // fully inside the parent box.
      const clampedX = Math.max(0, Math.min(proposedX, parent.w - el.widthValue));
      const clampedY = Math.max(0, Math.min(proposedY, parent.h - el.heightValue));
      moveElement(move.id, Math.round(clampedX), Math.round(clampedY));
      return;
    }
    if (reorder) {
      // Compute the drop indicator + target index based on which sibling
      // (if any) is under the cursor and which side of its center.
      const parent = elements[reorder.parentId];
      if (!parent) return;
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
        return;
      }

      const siblingRect = measureElementInFrame(hitSiblingId);
      if (!siblingRect) {
        setDropIndicator(null);
        return;
      }

      const isRow = parent.flexDirection === 'row';
      const { x: cursorX, y: cursorY } = toFrame(e.clientX, e.clientY);
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
      return;
    }
    if (resize) {
      const el = elements[resize.id];
      if (!el) return;
      const parent = parentSizeOf(el.parentId);
      const dx = (e.clientX - resize.pointerStartX) / scale;
      const dy = (e.clientY - resize.pointerStartY) / scale;
      let { originX: nx, originY: ny, originW: nw, originH: nh } = resize;
      if (resize.handle.includes('e')) nw = Math.max(MIN_SIZE, resize.originW + dx);
      if (resize.handle.includes('s')) nh = Math.max(MIN_SIZE, resize.originH + dy);
      if (resize.handle.includes('w')) {
        const proposedW = Math.max(MIN_SIZE, resize.originW - dx);
        nx = resize.originX + (resize.originW - proposedW);
        nw = proposedW;
      }
      if (resize.handle.includes('n')) {
        const proposedH = Math.max(MIN_SIZE, resize.originH - dy);
        ny = resize.originY + (resize.originH - proposedH);
        nh = proposedH;
      }
      const clamped = clampToParent(nx, ny, nw, nh, parent.w, parent.h);
      resizeElement(
        resize.id,
        Math.round(clamped.x),
        Math.round(clamped.y),
        Math.round(clamped.w),
        Math.round(clamped.h)
      );
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    if (reorder && dropIndicator) {
      // Commit the flex-sibling reorder. parentId stays the same — this
      // drag mode never re-parents.
      reorderElement(reorder.id, reorder.parentId, dropIndicator.newIndex);
    }
    if (reorder) {
      setReorder(null);
      setDropIndicator(null);
    }
    if (draw) {
      const dragX = Math.min(draw.startX, draw.currentX);
      const dragY = Math.min(draw.startY, draw.currentY);
      const dragW = Math.abs(draw.currentX - draw.startX);
      const dragH = Math.abs(draw.currentY - draw.startY);
      const parent = parentSizeOf(draw.parentId);

      // If the gesture was effectively a click (no meaningful drag),
      // drop a default-sized rect centered on the cursor instead. The
      // clamp helper afterwards keeps it inside the parent bounds.
      const wasClick =
        dragW < CLICK_DRAG_THRESHOLD && dragH < CLICK_DRAG_THRESHOLD;
      const x = wasClick ? draw.startX - DEFAULT_NEW_RECT_SIZE / 2 : dragX;
      const y = wasClick ? draw.startY - DEFAULT_NEW_RECT_SIZE / 2 : dragY;
      const w = wasClick ? DEFAULT_NEW_RECT_SIZE : dragW;
      const h = wasClick ? DEFAULT_NEW_RECT_SIZE : dragH;

      const clamped = clampToParent(x, y, w, h, parent.w, parent.h);
      if (clamped.w >= MIN_SIZE && clamped.h >= MIN_SIZE) {
        createRectangle({
          parentId: draw.parentId,
          x: Math.round(clamped.x),
          y: Math.round(clamped.y),
          width: Math.round(clamped.w),
          height: Math.round(clamped.h),
        });
        setTool('select');
      }
      setDraw(null);
    }
    setMove(null);
    setResize(null);
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const handleDoubleClick = (e: PointerEvent<HTMLDivElement>): void => {
    const hitId = hitTest(e.clientX, e.clientY);
    if (!hitId || hitId === ROOT_ELEMENT_ID) return;
    const el = elements[hitId];
    if (!el || el.type !== 'text') return;
    e.preventDefault();
    selectElement(hitId);
    setEditingElement(hitId);
  };

  const selectedEl = selectedElementId ? elements[selectedElementId] : null;
  const isEditing = editingElementId !== null;

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      style={{ pointerEvents: isEditing ? 'none' : 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {draw && (
        <DrawPreview
          x={Math.min(draw.startX, draw.currentX) + draw.parentOffsetX}
          y={Math.min(draw.startY, draw.currentY) + draw.parentOffsetY}
          width={Math.abs(draw.currentX - draw.startX)}
          height={Math.abs(draw.currentY - draw.startY)}
        />
      )}
      {dropIndicator && (
        <div
          className={styles.dropIndicator}
          style={{
            left: dropIndicator.rect.x,
            top: dropIndicator.rect.y,
            width: dropIndicator.rect.w,
            height: dropIndicator.rect.h,
          }}
        />
      )}
      {isSingleSelection && selectedEl && selectedRect && (
        // Position and size come from a DOM measurement of the selected
        // element, so the overlay always sits exactly where the user sees
        // the rect — including for flex children whose stored x/y is 0.
        // Resize handles are shown for everything except the page root
        // (which is sized via the panel) and flex children (whose size is
        // owned by flex layout, not by the user dragging corners). The
        // overlay is only rendered for a single selection — multi-select
        // highlights live on the elements themselves.
        <SelectionOverlay
          x={selectedRect.x}
          y={selectedRect.y}
          width={selectedRect.w}
          height={selectedRect.h}
          showHandles={selectedElementId !== ROOT_ELEMENT_ID && !isFlexChild(selectedEl)}
        />
      )}
    </div>
  );
};
