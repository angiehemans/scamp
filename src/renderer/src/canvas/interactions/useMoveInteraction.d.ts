import { type PointerEvent } from 'react';
import type { ScampElement } from '@lib/element';
import type { CanvasGeometry, MoveState } from './types';
export type MoveInteraction = {
    move: MoveState | null;
    /** Begin a move drag for the given (non-flex, non-root) element. */
    start: (e: PointerEvent<HTMLDivElement>, id: string, el: ScampElement) => void;
    /** Apply the move while dragging; returns true if a move is active. */
    onMove: (e: PointerEvent<HTMLDivElement>) => boolean;
    /** Commit the move transaction and clear state on pointer release. */
    onEnd: () => void;
};
/**
 * Move state machine for absolutely-positioned elements. A history
 * transaction wraps the per-tick `moveElement` calls so the drag commits
 * as a single `move` entry. Position is clamped to the parent's current
 * visible extent so an element can't be dragged off the page.
 */
export declare const useMoveInteraction: (geometry: CanvasGeometry, scale: number) => MoveInteraction;
