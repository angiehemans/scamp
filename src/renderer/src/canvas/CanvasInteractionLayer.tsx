import { MouseEvent, PointerEvent, RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawPreview } from './DrawPreview';
import { GridOverlay } from './GridOverlay';
import { LinkIndicators } from './LinkIndicators';
import { hitTest, propTextHitTest } from './interactions/canvasHitTest';
import { useCanvasGeometry } from './interactions/useCanvasGeometry';
import { useDrawInteraction } from './interactions/useDrawInteraction';
import { useMoveInteraction } from './interactions/useMoveInteraction';
import { useResizeInteraction } from './interactions/useResizeInteraction';
import { useReorderInteraction } from './interactions/useReorderInteraction';
import { useDropInsert } from './interactions/useDropInsert';
import type { SelectedRect } from './interactions/types';
import styles from './CanvasInteractionLayer.module.css';

type Props = {
  frameRef: RefObject<HTMLDivElement>;
  scale: number;
};

/**
 * The chrome layer that sits above the rendered canvas and owns all
 * pointer interaction. It holds the selection-overlay measurement and the
 * select-tool hit-testing, and dispatches drags to the per-tool state
 * machines: draw (rectangle / input / text / image), move, resize, reorder
 * (flex children), and OS image drop. See interactions/ for each hook.
 */
export const CanvasInteractionLayer = ({ frameRef, scale }: Props): JSX.Element => {
  const layerRef = useRef<HTMLDivElement>(null);
  // The selected element's bounding box, measured straight from the DOM in
  // frame-local (unscaled) coordinates. We measure rather than compute from
  // `el.x/el.y` so the overlay matches the rendered position exactly even
  // when layout quirks (padding, borders, flex flow) shift the element off
  // its stored coordinates.
  const [selectedRect, setSelectedRect] = useState<SelectedRect | null>(null);

  const elements = useCanvasStore((s) => s.elements);
  // The "primary" selection — used for resize-handle positioning, drag-to-
  // move, and as the focus of the properties panel. Multi-select highlights
  // are handled per-element via ElementRenderer.
  const selectedElementIds = useCanvasStore((s) => s.selectedElementIds);
  const selectedElementId = selectedElementIds[0] ?? null;
  const isSingleSelection = selectedElementIds.length === 1;
  const editingElementId = useCanvasStore((s) => s.editingElementId);
  // Prop-text inline editing on a component instance. While this is
  // non-null we drop the chrome layer's `pointer-events` so the
  // contentEditable target can receive clicks (cursor positioning,
  // text selection) without the layer eating them first.
  const editingInstanceProp = useCanvasStore((s) => s.editingInstanceProp);
  const setEditingInstanceProp = useCanvasStore(
    (s) => s.setEditingInstanceProp
  );
  const selectElement = useCanvasStore((s) => s.selectElement);
  const toggleSelectElement = useCanvasStore((s) => s.toggleSelectElement);
  const setEditingElement = useCanvasStore((s) => s.setEditingElement);

  // Frame-local geometry helpers (coord conversion, DOM measurement,
  // parent-bounds lookups) shared by every pointer handler.
  const geometry = useCanvasGeometry(frameRef, scale);
  const { measureElementInFrame, isFlexChild } = geometry;

  // Per-tool pointer state machines.
  const draw = useDrawInteraction(geometry);
  const move = useMoveInteraction(geometry, scale);
  const resize = useResizeInteraction(geometry, scale);
  const reorder = useReorderInteraction(geometry);
  const dropInsert = useDropInsert(geometry);

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

    // Resize takes precedence — handles sit on top of everything. Then the
    // active draw tool (rectangle / input / text / image).
    if (resize.tryStart(e)) return;
    if (draw.tryStart(e)) return;

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
      reorder.start(e, hitId, el.parentId);
      return;
    }
    move.start(e, hitId, el);
  };

  // Only one state machine is ever active per gesture, so each onMove
  // no-ops unless it owns the drag. Priority mirrors the original
  // draw → move → reorder → resize ordering.
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (draw.onMove(e)) return;
    if (move.onMove(e)) return;
    if (reorder.onMove(e)) return;
    resize.onMove(e);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
    reorder.onEnd();
    draw.onEnd();
    move.onEnd();
    resize.onEnd();
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const handleDoubleClick = (e: PointerEvent<HTMLDivElement>): void => {
    // Read-only while previewing a snapshot — no inline text editing.
    if (useCanvasStore.getState().snapshotPreview !== null) return;
    // Prop-text on a component instance — enter inline edit on
    // that prop. We check this BEFORE the regular text-element path
    // so prop-text on a `<p>` tag hits the per-instance flow rather
    // than the page-level `setEditingElement`.
    const propHit = propTextHitTest(e.clientX, e.clientY);
    if (propHit) {
      e.preventDefault();
      selectElement(propHit.instanceId);
      setEditingInstanceProp(propHit);
      return;
    }
    const hitId = hitTest(e.clientX, e.clientY);
    if (!hitId || hitId === ROOT_ELEMENT_ID) return;
    const el = elements[hitId];
    if (!el || el.type !== 'text') return;
    e.preventDefault();
    selectElement(hitId);
    setEditingElement(hitId);
  };

  // Right-click on the canvas opens the element context menu. The layer
  // sits above all canvas elements (z-index: 100), so element-level
  // onContextMenu handlers never fire — without this, Electron suppresses
  // the OS default menu and nothing visible happens. Hit-test under the
  // cursor, select that element, then dispatch the same custom event the
  // element-level handler would have, so `ElementContextMenu` renders.
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
    selectElement(hitId);
    window.dispatchEvent(
      new CustomEvent('scamp:open-element-context-menu', {
        detail: { x: e.clientX, y: e.clientY, elementId: hitId },
      })
    );
  };

  const selectedEl = selectedElementId ? elements[selectedElementId] : null;
  const isEditing =
    editingElementId !== null || editingInstanceProp !== null;
  const drawState = draw.draw;
  const dropIndicator = reorder.dropIndicator;

  return (
    <div
      ref={layerRef}
      className={styles.layer}
      data-canvas-chrome="true"
      style={{ pointerEvents: isEditing ? 'none' : 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragOver={dropInsert.handleDragOver}
      onDrop={dropInsert.handleDrop}
    >
      {drawState && (
        <DrawPreview
          x={Math.min(drawState.startX, drawState.currentX) + drawState.parentOffsetX}
          y={Math.min(drawState.startY, drawState.currentY) + drawState.parentOffsetY}
          width={Math.abs(drawState.currentX - drawState.startX)}
          height={Math.abs(drawState.currentY - drawState.startY)}
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
      <LinkIndicators frameRef={frameRef} />
      {isSingleSelection &&
        selectedElementId &&
        selectedEl &&
        selectedEl.display === 'grid' && (() => {
          const frame = frameRef.current;
          if (!frame) return null;
          const r = frame.getBoundingClientRect();
          return (
            <GridOverlay
              elementId={selectedElementId}
              frameRect={{ left: r.left, top: r.top }}
              scale={scale}
            />
          );
        })()}
    </div>
  );
};
