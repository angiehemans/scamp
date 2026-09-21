const lineOf = (text, offset) => {
    let line = 1;
    for (let i = 0; i < offset && i < text.length; i += 1) {
        if (text[i] === '\n')
            line += 1;
    }
    return line;
};
const countLines = (text) => text.length === 0 ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
/** The line-numbered view of edits against the text they apply to. */
export const hunksFor = (base, edits) => edits.map((edit) => ({
    line: lineOf(base, edit.start),
    removed: countLines(base.slice(edit.start, edit.end)),
    added: countLines(edit.replacement),
    text: edit.replacement,
}));
export const createPatchLog = (limit = 100) => {
    let entries = [];
    let revision = 0;
    const listeners = new Set();
    return {
        record: (entry) => {
            const files = entry.files.filter((f) => f.edits.length > 0);
            if (files.length === 0)
                return null;
            revision += 1;
            const recorded = { ...entry, files, revision };
            entries.push(recorded);
            if (entries.length > limit)
                entries = entries.slice(entries.length - limit);
            for (const listener of listeners) {
                try {
                    listener(recorded);
                }
                catch {
                    // A subscriber that throws is not a reason to fail a save.
                }
            }
            return recorded;
        },
        since: (from) => entries.filter((e) => e.revision > from),
        entries: () => [...entries],
        revision: () => revision,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        clear: () => {
            entries = [];
        },
    };
};
