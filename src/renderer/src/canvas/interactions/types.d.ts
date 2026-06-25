import type { ScampElement } from '@lib/element';
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type SelectedRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type DrawState = {
    parentId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    parentOffsetX: number;
    parentOffsetY: number;
};
export type MoveState = {
    id: string;
    pointerStartX: number;
    pointerStartY: number;
    originX: number;
    originY: number;
    /**
     * Frame-local offset of the cursor within the dragged element at grab
     * time. Used to preserve the grab point when reparenting into another
     * container so the element doesn't jump under the cursor on drop.
     */
    grabDX: number;
    grabDY: number;
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
    rect: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** The childIds index the drop will resolve to on release. */
    newIndex: number;
};
/**
 * A pending reparent into an ABSOLUTE container during a move drag. The
 * container is highlighted (`rect`) and, on release, the dragged element
 * is reparented and placed at `x`/`y` in the container's local space.
 * see docs/plans/canvas-drag-reparent-plan.md
 */
export type DropContainerTarget = {
    /** The container element the drop will reparent into. */
    id: string;
    /** Frame-local rect of the container, for the highlight outline. */
    rect: SelectedRect;
    /** Position for the dragged element in the container's local space. */
    x: number;
    y: number;
};
/**
 * Geometry helpers shared by every interaction hook, bound to the current
 * frame + scale + element tree. Produced by `useCanvasGeometry`.
 */
export type CanvasGeometry = {
    /** Convert viewport pointer coords to frame-local (logical) coords. */
    toFrame: (clientX: number, clientY: number) => {
        x: number;
        y: number;
    };
    /** Measure an element's bounding box in frame-local logical coords. */
    measureElementInFrame: (id: string) => SelectedRect | null;
    /** Parent inner-bounds size for clamping at the end of a draw. */
    parentSizeOf: (parentId: string | null) => {
        w: number;
        h: number;
    };
    /** Parent's current visible extent for clamping move / resize. */
    parentMoveBoundsOf: (parentId: string | null) => {
        w: number;
        h: number;
    };
    /** True if `el`'s parent is a flex container. */
    isFlexChild: (el: ScampElement | undefined) => boolean;
    /**
     * Resolve the deepest container under the cursor that `draggedId`
     * could reparent into. Skips the dragged element + its subtree and
     * non-container leaves (text / input / image / component-instance).
     * `isFlow` is true for flex/grid (insert-index drop) vs absolute
     * (x/y drop). Null when there's no valid container under the cursor.
     * see docs/plans/canvas-drag-reparent-plan.md
     */
    resolveDropContainer: (clientX: number, clientY: number, draggedId: string) => {
        parentId: string;
        isFlow: boolean;
    } | null;
};
