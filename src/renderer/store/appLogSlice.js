import { create } from 'zustand';
/**
 * Cap on retained entries. A very long-running session can produce a
 * lot of noise; the oldest entries drop off once we pass this limit.
 */
const MAX_ENTRIES = 500;
let nextId = 1;
export const useAppLogStore = create((set) => ({
    entries: [],
    log: (level, message) => {
        const entry = {
            id: nextId++,
            timestamp: Date.now(),
            level,
            message,
        };
        set((state) => {
            const next = [...state.entries, entry];
            if (next.length > MAX_ENTRIES)
                next.splice(0, next.length - MAX_ENTRIES);
            return { entries: next };
        });
    },
    clear: () => set({ entries: [] }),
}));
