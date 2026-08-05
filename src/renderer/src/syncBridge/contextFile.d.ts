import { type CanvasState } from '@store/canvasSlice';
export declare const cancelContextWrite: () => void;
/**
 * Store subscriber. Re-arms a debounce whenever anything the file reports
 * changes — the open target, the selection, or the selected element itself.
 *
 * Watching the selected element's OBJECT IDENTITY rather than the whole
 * `elements` map is what makes "styles changed" work without rewriting on
 * every unrelated edit: the store's spreads hand the edited element a new
 * identity and leave its siblings alone.
 */
export declare const makeContextFileHandler: () => (state: CanvasState, prev: CanvasState) => void;
/** Write immediately, skipping the debounce — used on install and teardown. */
export declare const flushContextWrite: () => void;
