import { type SnapshotInput } from '@lib/canvasSnapshot';
import { type CanvasState } from '@store/canvasSlice';
/** Everything the tools need, read from the store in one pass. */
export declare const snapshotInputFrom: (state: CanvasState) => SnapshotInput;
/**
 * Install the responder. Returns an unsubscribe for teardown.
 */
export declare const installMcpResponder: () => (() => void);
