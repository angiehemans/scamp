import { create } from 'zustand';

export type AppLogLevel = 'info' | 'warn' | 'error';

export type AppLogEntry = {
  /** Monotonic id — unique even for entries created in the same tick. */
  id: number;
  /** `Date.now()` timestamp when the entry was recorded. */
  timestamp: number;
  level: AppLogLevel;
  message: string;
};

type AppLogState = {
  entries: ReadonlyArray<AppLogEntry>;
  log: (level: AppLogLevel, message: string) => void;
  clear: () => void;
};

/**
 * Cap on retained entries. A very long-running session can produce a
 * lot of noise; the oldest entries drop off once we pass this limit.
 */
const MAX_ENTRIES = 500;

let nextId = 1;

export const useAppLogStore = create<AppLogState>((set) => ({
  entries: [],
  log: (level, message) => {
    const entry: AppLogEntry = {
      id: nextId++,
      timestamp: Date.now(),
      level,
      message,
    };
    set((state) => {
      const next = [...state.entries, entry];
      if (next.length > MAX_ENTRIES) next.splice(0, next.length - MAX_ENTRIES);
      return { entries: next };
    });
  },
  clear: () => set({ entries: [] }),
}));
