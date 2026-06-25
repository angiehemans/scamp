import { type PointerEvent } from 'react';
import type { ScampElement } from '@lib/element';
import type { CanvasGeometry, DropContainerTarget, MoveState } from './types';
export type MoveInteraction = {
    move: MoveState | null;
    /** Pending reparent into an absolute container (drives the highlight). */
    dropTarget: DropContainerTarget | null;
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
 * While dragging, the cursor is hit-tested for a different ABSOLUTE
 * container (`resolveDropContainer`); when one is found the element keeps
 * following the cursor inside its current parent AND the target container
 * is highlighted. On release over that target the element is reparented
 * and placed at the cursor point in the target's local space — committed
 * inside the same open transaction so it's a single undo step.
 * Flow (flex/grid) targets are handled in a later phase.
 * see docs/plans/canvas-drag-reparent-plan.md
 */
export declare const useMoveInteraction: (geometry: CanvasGeometry, scale: number) => MoveInteraction;
