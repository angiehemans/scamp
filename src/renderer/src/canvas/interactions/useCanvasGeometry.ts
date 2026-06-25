import { type RefObject } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

import type { CanvasGeometry, SelectedRect } from './types';

/**
 * Builds the frame-local geometry helpers the interaction hooks share:
 * coordinate conversion, DOM measurement, and the parent-bounds lookups
 * used to clamp draw / move / resize. Bound to the current frame element,
 * render scale, and element tree.
 *
 * The frame is rendered via `transform: scale`, which has well-defined,
 * platform-consistent behavior: `getBoundingClientRect()` returns the
 * visible (scaled) rect while `offsetWidth/Left` stay in logical pixels.
 */
export const useCanvasGeometry = (
  frameRef: RefObject<HTMLDivElement>,
  scale: number
): CanvasGeometry => {
  const elements = useCanvasStore((s) => s.elements);

  const toFrame = (
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    const frame = frameRef.current;
    if (!frame) return { x: 0, y: 0 };
    const rect = frame.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  /**
   * Measure an element's bounding box in frame-local (logical)
   * coordinates by querying the rendered DOM. Source of truth for the
   * selection overlay and the draw-tool parent offset.
   *
   * The frame is scaled with `transform: scale`, which doesn't touch
   * layout — so `offsetLeft/offsetTop/offsetWidth/offsetHeight` are
   * already in logical pixels and don't need to be divided by scale.
   */
  const measureElementInFrame = (id: string): SelectedRect | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const node = frame.querySelector(`[data-element-id="${id}"]`);
    if (!(node instanceof HTMLElement)) return null;

    // Walk up the offsetParent chain to the frame, accumulating logical
    // pixel offsets. offsetLeft/Top are always unaffected by ancestor
    // `transform: scale` since transforms don't reflow layout.
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

  /**
   * Look up a parent element's inner-bounds size for clamping at the
   * end of a draw. For non-root rects the stored
   * widthValue/heightValue is authoritative. For the root, stored
   * values are stale (root defaults to stretch/auto), so width comes
   * from the DOM and height is treated as unbounded — a user should
   * be able to draw a rectangle below the current content extent and
   * have the page grow to accommodate it.
   */
  const parentSizeOf = (parentId: string | null): { w: number; h: number } => {
    const id = parentId ?? ROOT_ELEMENT_ID;
    if (id === ROOT_ELEMENT_ID) {
      const measured = measureElementInFrame(ROOT_ELEMENT_ID);
      const rootWidth =
        measured?.w ?? elements[ROOT_ELEMENT_ID]?.widthValue ?? 1440;
      return { w: rootWidth, h: Number.POSITIVE_INFINITY };
    }
    const el = elements[id];
    if (!el) return { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY };
    return { w: el.widthValue, h: el.heightValue };
  };

  /**
   * Bounds for clamping move / resize operations. Unlike
   * `parentSizeOf` (which treats root height as unbounded so draws
   * can extend the page), move and resize clamp against the parent's
   * CURRENT visible extent — otherwise the user can drag an element
   * completely off the bottom of the page with no way to get it back.
   *
   * For root we use the canvas frame's rendered height rather than
   * root's own offsetHeight: root defaults to `height: auto` and its
   * children are `position: absolute`, which contribute nothing to
   * the CSS content-driven height — root would measure as zero and
   * every move would be locked at y=0.
   */
  const parentMoveBoundsOf = (
    parentId: string | null
  ): { w: number; h: number } => {
    const id = parentId ?? ROOT_ELEMENT_ID;
    if (id === ROOT_ELEMENT_ID) {
      const frame = frameRef.current;
      const measured = measureElementInFrame(ROOT_ELEMENT_ID);
      const el = elements[ROOT_ELEMENT_ID];
      return {
        w: measured?.w ?? el?.widthValue ?? 1440,
        h: frame?.offsetHeight ?? el?.heightValue ?? 900,
      };
    }
    const el = elements[id];
    if (!el) return { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY };
    return { w: el.widthValue, h: el.heightValue };
  };

  /** True if `el`'s parent is a flex container — i.e. flex layout owns its position. */
  const isFlexChild = (el: ScampElement | undefined): boolean => {
    if (!el || !el.parentId) return false;
    return elements[el.parentId]?.display === 'flex';
  };

  /** True if `id` is `ancestorId` or anywhere below it in the tree. */
  const isSelfOrDescendant = (id: string, ancestorId: string): boolean => {
    let cursor: string | null = id;
    while (cursor) {
      if (cursor === ancestorId) return true;
      cursor = elements[cursor]?.parentId ?? null;
    }
    return false;
  };

  const resolveDropContainer = (
    clientX: number,
    clientY: number,
    draggedId: string
  ): { parentId: string; isFlow: boolean } | null => {
    // elementsFromPoint is top→bottom in paint order, so the first
    // container we hit walking outward is the deepest one under the
    // cursor. The chrome layer has no `data-element-id`, so it's
    // skipped naturally.
    const candidates = document.elementsFromPoint(clientX, clientY);
    for (const node of candidates) {
      if (!(node instanceof HTMLElement)) continue;
      const id = node.dataset['elementId'];
      if (!id) continue;
      // Never drop into the dragged element or its own subtree.
      if (isSelfOrDescendant(id, draggedId)) continue;
      const el = elements[id];
      if (!el) continue;
      // Only rectangles hold children; text / image / input are leaves
      // and a component-instance is opaque on the page.
      if (el.type !== 'rectangle') continue;
      const isFlow = el.display === 'flex' || el.display === 'grid';
      return { parentId: id, isFlow };
    }
    return null;
  };

  return {
    toFrame,
    measureElementInFrame,
    parentSizeOf,
    parentMoveBoundsOf,
    isFlexChild,
    resolveDropContainer,
  };
};
