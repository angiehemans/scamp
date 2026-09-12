import { bindPropName, isRowPath } from '@lib/viewProps';
import { commitElementsToHistory } from '../history';
const withoutKey = (map, key) => {
    if (!map || !(key in map))
        return map;
    const { [key]: _dropped, ...rest } = map;
    return Object.keys(rest).length > 0 ? rest : undefined;
};
const setOptional = (el, key, value) => {
    if (value === undefined) {
        const { [key]: _dropped, ...rest } = el;
        return rest;
    }
    return { ...el, [key]: value };
};
/** True when any element other than `except` still refers to `name` as a show flag or repeat list. */
const sampleStillUsed = (elements, name, except) => Object.values(elements).some((el) => el.id !== except &&
    ((el.showIf !== undefined && bindPropName(el.showIf) === name) ||
        el.repeat?.over === name));
export const createBindingsSlice = (set) => ({
    setAttributeBinding: (id, attr, propName, inverted = false) => {
        let didChange = false;
        set((state) => {
            const el = state.elements[id];
            if (!el)
                return state;
            const expr = propName === null ? undefined : `${inverted ? '!' : ''}${propName}`;
            const current = el.bind?.[attr];
            if (current === expr)
                return state;
            const bind = expr === undefined
                ? withoutKey(el.bind, attr)
                : { ...(el.bind ?? {}), [attr]: expr };
            didChange = true;
            return { elements: { ...state.elements, [id]: setOptional(el, 'bind', bind) } };
        });
        if (didChange) {
            commitElementsToHistory({ kind: 'patch', elementIds: [id], propertyKeys: ['bind'] });
        }
    },
    setEventBinding: (id, event, handler) => {
        let didChange = false;
        set((state) => {
            const el = state.elements[id];
            if (!el)
                return state;
            if ((el.on?.[event] ?? null) === handler)
                return state;
            const on = handler === null ? withoutKey(el.on, event) : { ...(el.on ?? {}), [event]: handler };
            didChange = true;
            return { elements: { ...state.elements, [id]: setOptional(el, 'on', on) } };
        });
        if (didChange) {
            commitElementsToHistory({ kind: 'patch', elementIds: [id], propertyKeys: ['on'] });
        }
    },
    setRepeat: (id, repeat) => {
        let didChange = false;
        set((state) => {
            const el = state.elements[id];
            const root = state.elements[state.rootElementId];
            if (!el || !root || id === state.rootElementId)
                return state;
            const elements = { ...state.elements };
            const previous = el.repeat;
            if (repeat === null) {
                if (previous === undefined)
                    return state;
                elements[id] = setOptional(el, 'repeat', undefined);
                // Drop the rows when nothing else lists them.
                if (!sampleStillUsed(elements, previous.over, id)) {
                    elements[state.rootElementId] = setOptional(root, 'samples', withoutKey(root.samples, previous.over));
                }
                didChange = true;
                return { elements };
            }
            const next = repeat.key === undefined || repeat.key === 'id'
                ? { over: repeat.over, as: repeat.as }
                : repeat;
            elements[id] = { ...el, repeat: next };
            // Seed one row so the canvas has something to repeat and the
            // Data tab has a row to edit.
            const samples = { ...(root.samples ?? {}) };
            if (!Array.isArray(samples[next.over]))
                samples[next.over] = [{ id: '1' }];
            if (previous !== undefined && previous.over !== next.over && !sampleStillUsed(elements, previous.over, id)) {
                delete samples[previous.over];
            }
            elements[state.rootElementId] = { ...root, samples };
            didChange = true;
            return { elements };
        });
        if (didChange) {
            commitElementsToHistory({ kind: 'patch', elementIds: [id], propertyKeys: ['repeat'] });
        }
    },
    setShowIf: (id, flag) => {
        let didChange = false;
        set((state) => {
            const el = state.elements[id];
            const root = state.elements[state.rootElementId];
            if (!el || !root || id === state.rootElementId)
                return state;
            if ((el.showIf ?? null) === flag)
                return state;
            const elements = { ...state.elements };
            const previous = el.showIf;
            elements[id] = setOptional(el, 'showIf', flag ?? undefined);
            const samples = { ...(root.samples ?? {}) };
            if (flag !== null && !isRowPath(flag)) {
                const name = bindPropName(flag);
                if (typeof samples[name] !== 'boolean')
                    samples[name] = true;
            }
            if (previous !== undefined && !isRowPath(previous)) {
                const name = bindPropName(previous);
                if (name !== (flag === null ? null : bindPropName(flag)) && !sampleStillUsed(elements, name, id)) {
                    delete samples[name];
                }
            }
            elements[state.rootElementId] = setOptional(root, 'samples', Object.keys(samples).length > 0 ? samples : undefined);
            didChange = true;
            return { elements };
        });
        if (didChange) {
            commitElementsToHistory({ kind: 'patch', elementIds: [id], propertyKeys: ['showIf'] });
        }
    },
    setSampleFlag: (flag, value) => {
        let didChange = false;
        let rootId = '';
        set((state) => {
            const root = state.elements[state.rootElementId];
            if (!root || root.samples?.[flag] === value)
                return state;
            didChange = true;
            rootId = state.rootElementId;
            return {
                elements: {
                    ...state.elements,
                    [state.rootElementId]: { ...root, samples: { ...(root.samples ?? {}), [flag]: value } },
                },
            };
        });
        if (didChange) {
            commitElementsToHistory({
                kind: 'patch',
                elementIds: [rootId],
                propertyKeys: ['samples'],
            });
        }
    },
    setSampleRows: (over, rows) => {
        let didChange = false;
        let rootId = '';
        set((state) => {
            const root = state.elements[state.rootElementId];
            if (!root)
                return state;
            const next = rows.map((row) => ({ ...row }));
            didChange = true;
            rootId = state.rootElementId;
            return {
                elements: {
                    ...state.elements,
                    [state.rootElementId]: { ...root, samples: { ...(root.samples ?? {}), [over]: next } },
                },
            };
        });
        if (didChange) {
            commitElementsToHistory({
                kind: 'patch',
                elementIds: [rootId],
                propertyKeys: ['samples'],
            });
        }
    },
    renameBindingProp: (oldName, newName) => {
        if (oldName === newName || newName.length === 0)
            return;
        const touched = [];
        set((state) => {
            const elements = { ...state.elements };
            const rename = (expr) => bindPropName(expr) === oldName ? `${expr.startsWith('!') ? '!' : ''}${newName}` : expr;
            for (const [id, el] of Object.entries(state.elements)) {
                let next = el;
                if (el.bind) {
                    const bind = Object.fromEntries(Object.entries(el.bind).map(([k, v]) => [k, rename(v)]));
                    if (JSON.stringify(bind) !== JSON.stringify(el.bind))
                        next = { ...next, bind };
                }
                if (el.on) {
                    const on = Object.fromEntries(Object.entries(el.on).map(([k, v]) => [k, v === oldName ? newName : v]));
                    if (JSON.stringify(on) !== JSON.stringify(el.on))
                        next = { ...next, on };
                }
                if (el.showIf !== undefined && bindPropName(el.showIf) === oldName) {
                    next = { ...next, showIf: rename(el.showIf) };
                }
                if (el.repeat?.over === oldName)
                    next = { ...next, repeat: { ...el.repeat, over: newName } };
                const moved = el.samples?.[oldName];
                if (el.samples && moved !== undefined) {
                    const { [oldName]: _old, ...rest } = el.samples;
                    next = { ...next, samples: { ...rest, [newName]: moved } };
                }
                if (next !== el) {
                    elements[id] = next;
                    touched.push(id);
                }
            }
            return touched.length > 0 ? { elements } : state;
        });
        if (touched.length > 0) {
            commitElementsToHistory({
                kind: 'patch',
                elementIds: touched,
                propertyKeys: ['bind', 'on', 'showIf', 'repeat', 'samples'],
            });
        }
    },
});
