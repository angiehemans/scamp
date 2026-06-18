const noop = () => { };
/** Build a fresh save context with placeholder handlers (wired by init). */
export const createSaveContext = (quietWindow) => ({
    writeTimer: null,
    lastSerializedTsx: null,
    lastSerializedCss: null,
    canvasChangedDuringQuiet: false,
    quietResumeTimer: null,
    quietWindow,
    cancelWriteTimer: noop,
    onWriteConflict: noop,
    writeIfDirty: noop,
    flushDebouncedWrite: noop,
    reconcileAfterQuiet: noop,
    scheduleQuietResume: noop,
});
