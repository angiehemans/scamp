import type { KeyframesBlock, ScampElement } from '@lib/element';
import type { QuietWindow } from '../lib/quietWindow';
import type { EditTarget } from './editTarget';
export type WriteConflict = {
    actualTsxContent: string;
    actualCssContent: string;
};
export type SaveContext = {
    writeTimer: ReturnType<typeof setTimeout> | null;
    lastSerializedTsx: string | null;
    lastSerializedCss: string | null;
    /**
     * Set when a canvas edit lands while the quiet window is open (its
     * `writeIfDirty` gets deferred). `reconcileAfterQuiet` consults this
     * to decide whether to flush the pending canvas change after the
     * window expires, or to leave disk alone. Cleared on chokidar event
     * (start of quiet window) and after `reconcileAfterQuiet` runs.
     */
    canvasChangedDuringQuiet: boolean;
    quietResumeTimer: ReturnType<typeof setTimeout> | null;
    readonly quietWindow: QuietWindow;
    cancelWriteTimer: () => void;
    onWriteConflict: (target: EditTarget, conflict: WriteConflict, silent?: boolean) => void;
    writeIfDirty: (elements: Record<string, ScampElement>, rootElementId: string, target: EditTarget, customMediaBlocks: ReadonlyArray<string>, pageKeyframesBlocks: ReadonlyArray<KeyframesBlock>, silent?: boolean) => void;
    flushDebouncedWrite: () => void;
    reconcileAfterQuiet: () => void;
    scheduleQuietResume: () => void;
};
/** Build a fresh save context with placeholder handlers (wired by init). */
export declare const createSaveContext: (quietWindow: QuietWindow) => SaveContext;
