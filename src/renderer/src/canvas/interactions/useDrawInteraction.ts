import { type PointerEvent, useEffect, useState } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { clampToParent, MIN_SIZE } from '@lib/bounds';
import { resolveInsertParent } from '@lib/insertParent';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { prepareSvgForInsert } from '@renderer/src/lib/svg';

import { hitTest } from './canvasHitTest';
import {
  CLICK_DRAG_THRESHOLD,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_NEW_INPUT_HEIGHT,
  DEFAULT_NEW_INPUT_WIDTH,
  DEFAULT_NEW_RECT_SIZE,
  INLINE_SVG_MAX_BYTES,
} from './constants';
import type { CanvasGeometry, DrawState } from './types';

export type DrawInteraction = {
  draw: DrawState | null;
  /** Claim the gesture if a draw tool (rect/input/text/image) is active. */
  tryStart: (e: PointerEvent<HTMLDivElement>) => boolean;
  /** Update the in-progress draw rect; returns true if a draw is active. */
  onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
  /** Create the element from the drawn rect (or a click default) on release. */
  onEnd: () => void;
};

/**
 * Draw state machine for the rectangle / input / image tools, plus the
 * single-click text tool. Owns the `pendingImage` selection: activating
 * the image tool opens a file dialog, and once a file is chosen the
 * pointer drag draws the rect the image fills. A click (sub-threshold
 * drag) drops a default-sized element centered on the cursor.
 */
export const useDrawInteraction = (geometry: CanvasGeometry): DrawInteraction => {
  const [draw, setDraw] = useState<DrawState | null>(null);
  // Image tool: the chosen image's relative path + filename, set after the
  // user picks a file from the dialog. While this is non-null and the tool
  // is 'image', the pointer handlers work like the rectangle draw tool —
  // when the draw completes, an image element is created at the drawn rect.
  const [pendingImage, setPendingImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const activeTool = useCanvasStore((s) => s.activeTool);
  const projectFormat = useCanvasStore((s) => s.projectFormat);
  const projectPath = useCanvasStore((s) => s.projectPath);
  const activePage = useCanvasStore((s) => s.activePage);
  const setTool = useCanvasStore((s) => s.setTool);
  const createRectangle = useCanvasStore((s) => s.createRectangle);
  const createText = useCanvasStore((s) => s.createText);
  const createImage = useCanvasStore((s) => s.createImage);
  const createSvgElement = useCanvasStore((s) => s.createSvgElement);
  const createInput = useCanvasStore((s) => s.createInput);

  const { toFrame, measureElementInFrame, parentSizeOf } = geometry;

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
    if (pendingImage) return;
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
    void (async (): Promise<void> => {
      const chosen = await window.scamp.chooseImage({ defaultPath: assetsPath });
      if (cancelled) return;
      if (chosen.canceled || !chosen.path) {
        setTool('select');
        return;
      }
      // Copy to assets in every case — SVGs keep the on-disk reference for
      // reload; rasters are referenced by `<img src>`.
      const copied = await window.scamp.copyImage({
        sourcePath: chosen.path,
        projectPath,
      });
      if (cancelled) return;

      // New images/SVGs land inside the currently-selected container (or
      // its nearest container ancestor); with nothing selected they fall
      // back to the page root / draw-to-place.
      const store = useCanvasStore.getState();
      const selectedId = store.selectedElementIds[0] ?? null;
      const parentId = resolveInsertParent(
        store.elements,
        selectedId,
        ROOT_ELEMENT_ID
      );

      // SVG import: inline the (sanitized/normalized) markup so its colours
      // are editable, instead of an opaque <img>. Insert immediately at the
      // viewBox-derived size (ratio-locked in createSvgElement); the user
      // repositions/resizes after. Falls back to <img> for oversized or
      // unparseable files. see docs/plans/svg-color-editing-plan.md
      if (chosen.path.toLowerCase().endsWith('.svg')) {
        let raw = '';
        try {
          raw = await window.scamp.readFileText(chosen.path);
        } catch {
          raw = '';
        }
        if (cancelled) return;
        const prepared =
          raw.length > 0 && raw.length <= INLINE_SVG_MAX_BYTES
            ? prepareSvgForInsert(raw)
            : null;
        if (prepared) {
          const width = Math.max(
            MIN_SIZE,
            Math.round(prepared.width ?? DEFAULT_IMAGE_SIZE)
          );
          const height = Math.max(
            MIN_SIZE,
            Math.round(prepared.height ?? DEFAULT_IMAGE_SIZE)
          );
          createSvgElement({
            parentId,
            x: 40,
            y: 40,
            width,
            height,
            svgSource: prepared.svgSource,
            src: copied.relativePath,
            ...(prepared.viewBox !== undefined ? { viewBox: prepared.viewBox } : {}),
            ...(prepared.fill !== undefined ? { fill: prepared.fill } : {}),
            ...(prepared.stroke !== undefined ? { stroke: prepared.stroke } : {}),
            ...(prepared.strokeWidth !== undefined
              ? { strokeWidth: prepared.strokeWidth }
              : {}),
          });
          setTool('select');
          return;
        }
        // Large / unparseable svg → fall through to the <img> flow.
      }

      // With a container selected, drop the image straight into it at a
      // default size (matching paste). With nothing selected, keep the
      // draw-to-place gesture so the user can size/position it freely.
      if (selectedId) {
        createImage({
          parentId,
          x: 20,
          y: 20,
          width: DEFAULT_IMAGE_SIZE,
          height: DEFAULT_IMAGE_SIZE,
          src: copied.relativePath,
          alt: copied.fileName,
        });
        setTool('select');
        return;
      }
      setPendingImage({ src: copied.relativePath, alt: copied.fileName });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  const beginDrawAt = (e: PointerEvent<HTMLDivElement>): void => {
    const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
    const parentRect = measureElementInFrame(hitId) ?? { x: 0, y: 0, w: 0, h: 0 };
    const { x, y } = toFrame(e.clientX, e.clientY);
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraw({
      parentId: hitId,
      startX: x - parentRect.x,
      startY: y - parentRect.y,
      currentX: x - parentRect.x,
      currentY: y - parentRect.y,
      parentOffsetX: parentRect.x,
      parentOffsetY: parentRect.y,
    });
  };

  const tryStart = (e: PointerEvent<HTMLDivElement>): boolean => {
    // Read-only while previewing a snapshot — no draws or marquee selects.
    if (useCanvasStore.getState().snapshotPreview !== null) return false;
    if (activeTool === 'rectangle' || activeTool === 'input') {
      beginDrawAt(e);
      return true;
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
      return true;
    }

    if (activeTool === 'image' && pendingImage) {
      // File already chosen — draw a rectangle for the image to fill.
      beginDrawAt(e);
      return true;
    }

    return false;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>): boolean => {
    if (!draw) return false;
    const { x, y } = toFrame(e.clientX, e.clientY);
    setDraw({
      ...draw,
      currentX: x - draw.parentOffsetX,
      currentY: y - draw.parentOffsetY,
    });
    return true;
  };

  const onEnd = (): void => {
    if (!draw) return;
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
    const wasClick =
      dragW < CLICK_DRAG_THRESHOLD && dragH < CLICK_DRAG_THRESHOLD;
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
      } else if (wasInput) {
        createInput({
          parentId: draw.parentId,
          x: Math.round(clamped.x),
          y: Math.round(clamped.y),
          width: Math.round(clamped.w),
          height: Math.round(clamped.h),
        });
      } else {
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
  };

  return { draw, tryStart, onMove, onEnd };
};
