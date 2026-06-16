import { type HistoryCommitInput } from '../historySlice';
/** Pick a fresh element id that doesn't collide with any existing one. */
export declare const freshId: (existing: ReadonlySet<string>) => string;
/**
 * Snapshot the current elements map and push a history entry. Called
 * from every mutation that should be undoable. No-op when called
 * outside an active page — see `useHistoryStore.commitHistory`.
 */
export declare const commitElementsToHistory: (input: HistoryCommitInput) => void;
