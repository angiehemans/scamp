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
export declare const useAppLogStore: import("zustand").UseBoundStore<import("zustand").StoreApi<AppLogState>>;
export {};
