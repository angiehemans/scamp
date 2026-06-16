import { generateElementId } from '@lib/element';
import { useHistoryStore, type HistoryCommitInput } from '../historySlice';
// Circular by design: the store reference is only read inside
// `commitElementsToHistory`, which is called from actions (after the
// store is fully constructed), so the live binding is always populated
// by the time it runs.
import { useCanvasStore } from '../canvasSlice';

/** Pick a fresh element id that doesn't collide with any existing one. */
export const freshId = (existing: ReadonlySet<string>): string => {
  for (let i = 0; i < 32; i += 1) {
    const candidate = generateElementId();
    if (!existing.has(candidate)) return candidate;
  }
  let i = 0;
  while (existing.has(`g${i}`)) i += 1;
  return `g${i}`;
};

/**
 * Snapshot the current elements map and push a history entry. Called
 * from every mutation that should be undoable. No-op when called
 * outside an active page — see `useHistoryStore.commitHistory`.
 */
export const commitElementsToHistory = (input: HistoryCommitInput): void => {
  useHistoryStore
    .getState()
    .commitHistory(input, useCanvasStore.getState().elements);
};
