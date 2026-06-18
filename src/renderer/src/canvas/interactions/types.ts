// Shared types for the canvas pointer-interaction hooks (Phase 5.3 split).
// CanvasInteractionLayer composes the per-tool hooks; these types describe
// the in-flight state of each pointer state machine and the geometry
// helpers the hooks share.
import type { ScampElement } from '@lib/element';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type SelectedRect = { x: number; y: number; w: number; h: number };

export type DrawState = {
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

export type MoveState = {
  id: string;
  pointerStartX: number;
  pointerStartY: number;
  originX: number;
  originY: number;
};

export type ResizeState = {
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
export type ReorderState = {
  id: string;
  parentId: string;
};

export type DropIndicator = {
  /** Frame-local rect to draw the drop line. */
  rect: { x: number; y: number; w: number; h: number };
  /** The childIds index the drop will resolve to on release. */
  newIndex: number;
};

/**
 * Geometry helpers shared by every interaction hook, bound to the current
 * frame + scale + element tree. Produced by `useCanvasGeometry`.
 */
export type CanvasGeometry = {
  /** Convert viewport pointer coords to frame-local (logical) coords. */
  toFrame: (clientX: number, clientY: number) => { x: number; y: number };
  /** Measure an element's bounding box in frame-local logical coords. */
  measureElementInFrame: (id: string) => SelectedRect | null;
  /** Parent inner-bounds size for clamping at the end of a draw. */
  parentSizeOf: (parentId: string | null) => { w: number; h: number };
  /** Parent's current visible extent for clamping move / resize. */
  parentMoveBoundsOf: (parentId: string | null) => { w: number; h: number };
  /** True if `el`'s parent is a flex container. */
  isFlexChild: (el: ScampElement | undefined) => boolean;
};
