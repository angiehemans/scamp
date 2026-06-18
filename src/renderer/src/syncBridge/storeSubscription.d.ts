import { type CanvasState } from '@store/canvasSlice';
import { useTerminalActivityStore } from '@store/terminalActivitySlice';
import type { SaveContext } from './saveContext';
type TerminalActivityState = ReturnType<typeof useTerminalActivityStore.getState>;
/**
 * Phase 4.3 — react when an agent appears or finishes in any integrated
 * terminal. idle → busy: cancel the debounce + pause proactively so the
 * next canvas write can't race the agent's first write. busy → idle: if
 * the quiet window is also clear, reconcile now; otherwise leave the
 * quiet-resume timer to do it when its window expires.
 */
export declare const makeAgentSubscriptionHandler: (ctx: SaveContext) => (s: TerminalActivityState) => void;
/**
 * The canvas-store subscription: detects target swaps (flush outgoing,
 * reset the write cache), refreshes the cache + canonically migrates on
 * load, and schedules the debounced disk write on a genuine canvas edit.
 */
export declare const makeStoreSubscriptionHandler: (ctx: SaveContext) => (state: CanvasState, prev: CanvasState) => void;
export {};
