import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { useHistoryStore } from '@store/historySlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { clampToParent, MIN_SIZE } from '@lib/bounds';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawPreview } from './DrawPreview';
import { GridOverlay } from './GridOverlay';
import { LinkIndicators } from './LinkIndicators';
import { hitTest, propTextHitTest, isResizeHandle, } from './interactions/canvasHitTest';
import { useCanvasGeometry } from './interactions/useCanvasGeometry';
import styles from './CanvasInteractionLayer.module.css';
/** Default size for image elements placed via click (not drag). */
const DEFAULT_IMAGE_SIZE = 200;
/**
 * If the user just clicks (rather than drag-drawing) with the rectangle
 * tool, we drop a default-sized rect centered on the cursor. Anything
 * smaller than `CLICK_DRAG_THRESHOLD` on either axis counts as "click,
 * not drag".
 */
const CLICK_DRAG_THRESHOLD = 5;
const DEFAULT_NEW_RECT_SIZE = 200;
/** Default size for an input element placed via click (not drag). */
const DEFAULT_NEW_INPUT_WIDTH = 240;
const DEFAULT_NEW_INPUT_HEIGHT = 32;
export const CanvasInteractionLayer = ({ frameRef, scale }) => {
    const layerRef = useRef(null);
    const [draw, setDraw] = useState(null);
    const [move, setMove] = useState(null);
    const [resize, setResize] = useState(null);
    const [reorder, setReorder] = useState(null);
    const [dropIndicator, setDropIndicator] = useState(null);
    // The selected element's bounding box, measured straight from the DOM in
    // frame-local (unscaled) coordinates. We measure rather than compute from
    // `el.x/el.y` so the overlay matches the rendered position exactly even
    // when layout quirks (padding, borders, flex flow) shift the element off
    // its stored coordinates.
    const [selectedRect, setSelectedRect] = useState(null);
    // Image tool: the chosen image's relative path + filename, set after the
    // user picks a file from the dialog. While this is non-null and the tool
    // is 'image', the pointer handlers work like the rectangle draw tool —
    // when the draw completes, an image element is created at the drawn rect.
    const [pendingImage, setPendingImage] = useState(null);
    const activeTool = useCanvasStore((s) => s.activeTool);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const projectPath = useCanvasStore((s) => s.projectPath);
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
    const setEditingInstanceProp = useCanvasStore((s) => s.setEditingInstanceProp);
    const selectElement = useCanvasStore((s) => s.selectElement);
    const toggleSelectElement = useCanvasStore((s) => s.toggleSelectElement);
    const setTool = useCanvasStore((s) => s.setTool);
    const createRectangle = useCanvasStore((s) => s.createRectangle);
    const createText = useCanvasStore((s) => s.createText);
    const createImage = useCanvasStore((s) => s.createImage);
    const createInput = useCanvasStore((s) => s.createInput);
    const setEditingElement = useCanvasStore((s) => s.setEditingElement);
    const moveElement = useCanvasStore((s) => s.moveElement);
    const resizeElement = useCanvasStore((s) => s.resizeElement);
    const reorderElement = useCanvasStore((s) => s.reorderElement);
    const activePage = useCanvasStore((s) => s.activePage);
    // Frame-local geometry helpers (coord conversion, DOM measurement,
    // parent-bounds lookups) shared by every pointer handler.
    const { toFrame, measureElementInFrame, parentSizeOf, parentMoveBoundsOf, isFlexChild, } = useCanvasGeometry(frameRef, scale);
    // When the image tool is activated, immediately open a file dialog so
    // the user picks a file before drawing. If they cancel, revert to the
    // select tool. If they pick a file, copy it into assets/ and store the
    // result so the draw handler can create an image element on pointer-up.
    useEffect(() => {
        if (activeTool !== 'image') {
            setPendingImage(null);
            return;
        }
        // Already have a pending image (e.g. re-render), don't re-open dialog.
        if (pendingImage)
            return;
        if (!activePage) {
            setTool('select');
            return;
        }
        if (!projectPath) {
            setTool('select');
            return;
        }
        const assetsPath = `${projectPath}/${assetsDirSegment(projectFormat)}`;
        let cancelled = false;
        void (async () => {
            const chosen = await window.scamp.chooseImage({ defaultPath: assetsPath });
            if (cancelled)
                return;
            if (chosen.canceled || !chosen.path) {
                setTool('select');
                return;
            }
            const copied = await window.scamp.copyImage({
                sourcePath: chosen.path,
                projectPath,
            });
            if (cancelled)
                return;
            setPendingImage({ src: copied.relativePath, alt: copied.fileName });
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTool]);
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
    const handlePointerDown = (e) => {
        if (e.button !== 0)
            return;
        const target = e.target;
        const handle = isResizeHandle(e.clientX, e.clientY);
        // Resize takes precedence — handles sit on top of everything. Only
        // active when exactly one element is selected (we don't show handles
        // for multi-select).
        if (handle && selectedElementId && isSingleSelection) {
            const el = elements[selectedElementId];
            if (!el)
                return;
            e.preventDefault();
            target.setPointerCapture(e.pointerId);
            // Open a history transaction so the per-tick `resizeElement`
            // calls during the drag don't each create their own history
            // entry. The wrapping `endHistoryTransaction` in
            // `handlePointerUp` commits a single `resize` entry on
            // pointer release.
            useHistoryStore.getState().beginHistoryTransaction();
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
        if (activeTool === 'rectangle' || activeTool === 'input') {
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
            const localX = x - parentRect.x;
            const localY = y - parentRect.y;
            // Keep the top-left inside the parent so the text isn't placed at
            // a negative offset, but don't force the whole text box to fit —
            // a `parent.w - TEXT_W` clamp drags the text leftward whenever the
            // parent is narrower than the click position plus the default
            // text width, which makes the text land well away from the cursor.
            // Landing at the click point matches user expectation; spill is
            // harmless because the text element sits in its own layer.
            const clampedX = Math.max(0, localX);
            const clampedY = Math.max(0, localY);
            e.preventDefault();
            createText({
                parentId: hitId,
                x: Math.round(clampedX),
                y: Math.round(clampedY),
            });
            setTool('select');
            return;
        }
        if (activeTool === 'image' && pendingImage) {
            // File already chosen — draw a rectangle for the image to fill.
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
        // Select tool
        const hitId = hitTest(e.clientX, e.clientY);
        if (!hitId) {
            // Plain click on empty canvas clears selection. Shift+click never
            // clears so the user can keep building up a multi-select set.
            if (!e.shiftKey)
                selectElement(null);
            return;
        }
        if (e.shiftKey) {
            toggleSelectElement(hitId);
            return;
        }
        selectElement(hitId);
        const el = elements[hitId];
        if (!el)
            return;
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
        // Open a history transaction so per-tick `moveElement` calls
        // during the drag coalesce into a single `move` entry on
        // pointer release.
        useHistoryStore.getState().beginHistoryTransaction();
        setMove({
            id: hitId,
            pointerStartX: e.clientX,
            pointerStartY: e.clientY,
            originX: el.x,
            originY: el.y,
        });
    };
    const handlePointerMove = (e) => {
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
            if (!el)
                return;
            const parent = parentMoveBoundsOf(el.parentId);
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
            if (!parent)
                return;
            const siblingIds = parent.childIds.filter((id) => id !== reorder.id);
            // Find the topmost sibling under the cursor via elementsFromPoint.
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
            if (!el)
                return;
            const parent = parentMoveBoundsOf(el.parentId);
            const dx = (e.clientX - resize.pointerStartX) / scale;
            const dy = (e.clientY - resize.pointerStartY) / scale;
            let { originX: nx, originY: ny, originW: nw, originH: nh } = resize;
            if (resize.handle.includes('e'))
                nw = Math.max(MIN_SIZE, resize.originW + dx);
            if (resize.handle.includes('s'))
                nh = Math.max(MIN_SIZE, resize.originH + dy);
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
            resizeElement(resize.id, Math.round(clamped.x), Math.round(clamped.y), Math.round(clamped.w), Math.round(clamped.h));
        }
    };
    const handlePointerUp = (e) => {
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
            const wasInput = activeTool === 'input';
            const defaultWidth = pendingImage
                ? DEFAULT_IMAGE_SIZE
                : wasInput
                    ? DEFAULT_NEW_INPUT_WIDTH
                    : DEFAULT_NEW_RECT_SIZE;
            const defaultHeight = pendingImage
                ? DEFAULT_IMAGE_SIZE
                : wasInput
                    ? DEFAULT_NEW_INPUT_HEIGHT
                    : DEFAULT_NEW_RECT_SIZE;
            const wasClick = dragW < CLICK_DRAG_THRESHOLD && dragH < CLICK_DRAG_THRESHOLD;
            const x = wasClick ? draw.startX - defaultWidth / 2 : dragX;
            const y = wasClick ? draw.startY - defaultHeight / 2 : dragY;
            const w = wasClick ? defaultWidth : dragW;
            const h = wasClick ? defaultHeight : dragH;
            const clamped = clampToParent(x, y, w, h, parent.w, parent.h);
            if (clamped.w >= MIN_SIZE && clamped.h >= MIN_SIZE) {
                if (pendingImage) {
                    createImage({
                        parentId: draw.parentId,
                        x: Math.round(clamped.x),
                        y: Math.round(clamped.y),
                        width: Math.round(clamped.w),
                        height: Math.round(clamped.h),
                        src: pendingImage.src,
                        alt: pendingImage.alt,
                    });
                    setPendingImage(null);
                }
                else if (wasInput) {
                    createInput({
                        parentId: draw.parentId,
                        x: Math.round(clamped.x),
                        y: Math.round(clamped.y),
                        width: Math.round(clamped.w),
                        height: Math.round(clamped.h),
                    });
                }
                else {
                    createRectangle({
                        parentId: draw.parentId,
                        x: Math.round(clamped.x),
                        y: Math.round(clamped.y),
                        width: Math.round(clamped.w),
                        height: Math.round(clamped.h),
                    });
                }
                setTool('select');
            }
            setDraw(null);
        }
        if (move) {
            // Close the move transaction — commits one `move` entry
            // covering the drag and drains any external edit that
            // arrived mid-drag.
            useHistoryStore
                .getState()
                .endHistoryTransaction({ kind: 'move', elementIds: [move.id] }, useCanvasStore.getState().elements);
        }
        if (resize) {
            useHistoryStore
                .getState()
                .endHistoryTransaction({ kind: 'resize', elementIds: [resize.id] }, useCanvasStore.getState().elements);
        }
        setMove(null);
        setResize(null);
        const target = e.target;
        if (target.hasPointerCapture(e.pointerId)) {
            target.releasePointerCapture(e.pointerId);
        }
    };
    const handleDoubleClick = (e) => {
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
        if (!hitId || hitId === ROOT_ELEMENT_ID)
            return;
        const el = elements[hitId];
        if (!el || el.type !== 'text')
            return;
        e.preventDefault();
        selectElement(hitId);
        setEditingElement(hitId);
    };
    const handleDragOver = (e) => {
        // Accept image files from the OS file manager.
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        if (!activePage)
            return;
        const files = e.dataTransfer.files;
        if (files.length === 0)
            return;
        const file = files[0];
        // Only accept image types.
        if (!file.type.startsWith('image/'))
            return;
        // Electron gives us the file path on the `path` property.
        const filePath = file.path;
        if (!filePath)
            return;
        if (!projectPath)
            return;
        const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
        const parentRect = measureElementInFrame(hitId) ?? { x: 0, y: 0, w: 0, h: 0 };
        const { x, y } = toFrame(e.clientX, e.clientY);
        const parent = parentSizeOf(hitId);
        void (async () => {
            const copied = await window.scamp.copyImage({
                sourcePath: filePath,
                projectPath,
            });
            const localX = x - parentRect.x;
            const localY = y - parentRect.y;
            const clampedX = Math.max(0, Math.min(localX, parent.w - DEFAULT_IMAGE_SIZE));
            const clampedY = Math.max(0, Math.min(localY, parent.h - DEFAULT_IMAGE_SIZE));
            createImage({
                parentId: hitId,
                x: Math.round(clampedX),
                y: Math.round(clampedY),
                width: DEFAULT_IMAGE_SIZE,
                height: DEFAULT_IMAGE_SIZE,
                src: copied.relativePath,
                alt: copied.fileName,
            });
        })();
    };
    // Right-click on the canvas opens the element context menu. The layer
    // sits above all canvas elements (z-index: 100), so element-level
    // onContextMenu handlers never fire — without this, Electron suppresses
    // the OS default menu and nothing visible happens. Hit-test under the
    // cursor, select that element, then dispatch the same custom event the
    // element-level handler would have, so `ElementContextMenu` renders.
    const handleContextMenu = (e) => {
        e.preventDefault();
        const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
        selectElement(hitId);
        window.dispatchEvent(new CustomEvent('scamp:open-element-context-menu', {
            detail: { x: e.clientX, y: e.clientY, elementId: hitId },
        }));
    };
    const selectedEl = selectedElementId ? elements[selectedElementId] : null;
    const isEditing = editingElementId !== null || editingInstanceProp !== null;
    return (_jsxs("div", { ref: layerRef, className: styles.layer, "data-canvas-chrome": "true", style: { pointerEvents: isEditing ? 'none' : 'auto' }, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerCancel: handlePointerUp, onDoubleClick: handleDoubleClick, onContextMenu: handleContextMenu, onDragOver: handleDragOver, onDrop: handleDrop, children: [draw && (_jsx(DrawPreview, { x: Math.min(draw.startX, draw.currentX) + draw.parentOffsetX, y: Math.min(draw.startY, draw.currentY) + draw.parentOffsetY, width: Math.abs(draw.currentX - draw.startX), height: Math.abs(draw.currentY - draw.startY) })), dropIndicator && (_jsx("div", { className: styles.dropIndicator, style: {
                    left: dropIndicator.rect.x,
                    top: dropIndicator.rect.y,
                    width: dropIndicator.rect.w,
                    height: dropIndicator.rect.h,
                } })), isSingleSelection && selectedEl && selectedRect && (
            // Position and size come from a DOM measurement of the selected
            // element, so the overlay always sits exactly where the user sees
            // the rect — including for flex children whose stored x/y is 0.
            // Resize handles are shown for everything except the page root
            // (which is sized via the panel) and flex children (whose size is
            // owned by flex layout, not by the user dragging corners). The
            // overlay is only rendered for a single selection — multi-select
            // highlights live on the elements themselves.
            _jsx(SelectionOverlay, { x: selectedRect.x, y: selectedRect.y, width: selectedRect.w, height: selectedRect.h, showHandles: selectedElementId !== ROOT_ELEMENT_ID && !isFlexChild(selectedEl) })), _jsx(LinkIndicators, { frameRef: frameRef }), isSingleSelection &&
                selectedElementId &&
                selectedEl &&
                selectedEl.display === 'grid' && (() => {
                const frame = frameRef.current;
                if (!frame)
                    return null;
                const r = frame.getBoundingClientRect();
                return (_jsx(GridOverlay, { elementId: selectedElementId, frameRect: { left: r.left, top: r.top }, scale: scale }));
            })()] }));
};
