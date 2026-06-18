export const DEFAULT_SETTINGS = {
    defaultProjectsFolder: null,
    artboardBackground: '#0f0f0f',
    sentryOptIn: null,
};
/**
 * Parse a Settings JSON blob with migration / defaulting. Pure so the
 * sync startup read and the async IPC read share one source of truth,
 * and so it can be unit-tested without touching Electron's userData
 * path. Any structural surprise falls back to a default.
 */
export const parseSettingsBlob = (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object')
        return { ...DEFAULT_SETTINGS };
    const obj = parsed;
    const folder = obj['defaultProjectsFolder'];
    const artboard = obj['artboardBackground'];
    // Migrate: old `canvasBackground` key mapped to the same concept.
    const legacy = obj['canvasBackground'];
    const artboardValue = typeof artboard === 'string'
        ? artboard
        : typeof legacy === 'string'
            ? legacy
            : DEFAULT_SETTINGS.artboardBackground;
    const optIn = obj['sentryOptIn'];
    return {
        defaultProjectsFolder: typeof folder === 'string' ? folder : null,
        artboardBackground: artboardValue,
        sentryOptIn: typeof optIn === 'boolean' ? optIn : null,
    };
};
