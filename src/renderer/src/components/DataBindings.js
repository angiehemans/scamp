import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { classNameFor } from '@lib/generateCode/internal';
import { TAG_ATTRIBUTES } from '@lib/elementTags';
import { tagFor } from '@lib/generateCode/internal';
import { BOOLEAN_ATTRIBUTES, bindPropName, collectViewProps, enclosingRepeat, isInvertedBinding, isRowPath, } from '@lib/viewProps';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './DataPanel.module.css';
/**
 * The Data tab's binding sections — Attributes, Events, Repeat, Show —
 * for the component or view being edited. Text props and slots stay in
 * DataPanel. Every edit goes through the bindings store slice.
 * see docs/notes/view-bindings.md
 */
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const EVENT_BY_TAG = {
    button: ['onClick'],
    a: ['onClick'],
    input: ['onChange'],
    textarea: ['onChange'],
    select: ['onChange'],
    form: ['onSubmit'],
};
/** Attributes a binding may attach to: the typed ones for the tag, plus any present. */
const attributeCandidates = (el) => {
    if (el.type === 'component-instance') {
        return [...new Set([...Object.keys(el.propOverrides ?? {}), ...Object.keys(el.bind ?? {})])];
    }
    const tag = tagFor(el);
    const typed = (TAG_ATTRIBUTES[tag] ?? []).map((spec) => spec.name);
    const link = tag === 'a' ? ['href', 'target'] : [];
    const present = Object.keys(el.attributes ?? {});
    const bound = Object.keys(el.bind ?? {});
    return [...new Set([...typed, ...link, ...present, ...bound])].filter((n) => n !== 'key');
};
const isBooleanAttribute = (el, attr) => {
    if (el.type === 'component-instance')
        return false;
    if (BOOLEAN_ATTRIBUTES.has(attr))
        return true;
    return (TAG_ATTRIBUTES[tagFor(el)] ?? []).some((s) => s.name === attr && s.kind === 'boolean');
};
const eventCandidates = (el) => {
    if (el.type === 'component-instance')
        return Object.keys(el.on ?? {});
    return [...new Set([...(EVENT_BY_TAG[tagFor(el)] ?? []), ...Object.keys(el.on ?? {})])];
};
const elementLabel = (el) => el.type === 'component-instance' ? `${el.componentName ?? 'Instance'} ${el.instanceId ?? ''}`.trim() : classNameFor(el);
/**
 * A prop name, or a row path (`item.label`) when the element sits inside
 * a repeat. Returns the validation message, or null when acceptable.
 */
const validateBindingName = (name, elements, elementId, taken) => {
    if (name.length === 0)
        return 'Name the prop.';
    const repeat = enclosingRepeat(elements, elementId);
    if (isRowPath(name)) {
        const [head, ...rest] = name.split('.');
        if (repeat === null)
            return 'A row field needs a repeat above this element.';
        if (head !== repeat.as)
            return `Row fields start with ${repeat.as}.`;
        if (rest.length !== 1 || !FIELD_NAME_RE.test(rest[0] ?? ''))
            return 'Use one field: item.field';
        return null;
    }
    if (!PROP_NAME_RE.test(name))
        return 'Use lowerCamelCase letters / digits only.';
    if (taken.includes(name))
        return 'Already used by another prop.';
    return null;
};
/** A draft text input that commits on blur / Enter and reverts on Escape. */
const NameInput = ({ value, onCommit, validate, ariaLabel, placeholder, }) => {
    const [draft, setDraft] = useState(value);
    const [error, setError] = useState(null);
    useEffect(() => {
        setDraft(value);
        setError(null);
    }, [value]);
    const commit = () => {
        const next = draft.trim();
        if (next === value) {
            setError(null);
            return;
        }
        const problem = validate(next);
        setError(problem);
        if (problem === null)
            onCommit(next);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter')
            e.currentTarget.blur();
        if (e.key === 'Escape') {
            setDraft(value);
            setError(null);
            e.currentTarget.blur();
        }
    };
    return (_jsxs("div", { className: styles.renameWrap, children: [_jsx("input", { className: styles.renameInput, type: "text", value: draft, placeholder: placeholder, onChange: (e) => setDraft(e.target.value), onBlur: commit, onKeyDown: handleKeyDown, spellCheck: false, "aria-label": ariaLabel }), error && _jsx("div", { className: styles.renameError, children: error })] }));
};
const LOCKED_PROP = [
    { value: 'locked', label: 'Locked' },
    { value: 'prop', label: 'Prop' },
];
const NONE_PROP = [
    { value: 'none', label: 'None' },
    { value: 'prop', label: 'Prop' },
];
/** A name no prop uses yet: `base`, then `base2`, `base3`, … */
export const freePropName = (base, taken) => {
    if (!taken.includes(base))
        return base;
    let n = 2;
    while (taken.includes(`${base}${n}`))
        n += 1;
    return `${base}${n}`;
};
/**
 * Does this element have anything the Data tab can say about it? Used
 * to decide whether selecting it is worth narrowing the tab to — an
 * element with nothing to bind would leave an empty panel.
 */
export const hasBindableData = (el) => attributeCandidates(el).length > 0 ||
    eventCandidates(el).length > 0 ||
    el.repeat !== undefined ||
    el.showIf !== undefined;
export const BindingSections = ({ onlyElementId = null, } = {}) => {
    const elements = useCanvasStore((s) => s.elements);
    const rootId = useCanvasStore((s) => s.rootElementId);
    const setAttributeBinding = useCanvasStore((s) => s.setAttributeBinding);
    const setEventBinding = useCanvasStore((s) => s.setEventBinding);
    const setRepeat = useCanvasStore((s) => s.setRepeat);
    const setShowIf = useCanvasStore((s) => s.setShowIf);
    const setSampleFlag = useCanvasStore((s) => s.setSampleFlag);
    const setSampleRows = useCanvasStore((s) => s.setSampleRows);
    const renameBindingProp = useCanvasStore((s) => s.renameBindingProp);
    const selectElement = useCanvasStore((s) => s.selectElement);
    const propNames = useMemo(() => collectViewProps(elements, rootId).map((p) => p.name), [elements, rootId]);
    const ordered = useMemo(() => {
        const out = [];
        const walk = (id) => {
            const el = elements[id];
            if (!el)
                return;
            if (id !== rootId)
                out.push(el);
            for (const childId of el.childIds)
                walk(childId);
        };
        walk(rootId);
        return onlyElementId === null ? out : out.filter((el) => el.id === onlyElementId);
    }, [elements, rootId, onlyElementId]);
    const samples = elements[rootId]?.samples ?? {};
    const attributeRows = ordered.flatMap((el) => attributeCandidates(el).map((attr) => ({ el, attr, expr: el.bind?.[attr] })));
    const eventRows = ordered.flatMap((el) => eventCandidates(el).map((event) => ({ el, event, handler: el.on?.[event] })));
    const repeatRows = ordered.filter((el) => el.repeat !== undefined);
    const showRows = ordered.filter((el) => el.showIf !== undefined);
    if (attributeRows.length === 0 && eventRows.length === 0 && repeatRows.length === 0 && showRows.length === 0) {
        return null;
    }
    const otherNames = (own) => propNames.filter((n) => n !== own);
    return (_jsxs(_Fragment, { children: [repeatRows.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.sectionTitle, children: "Repeat" }), _jsx("div", { className: styles.rows, children: repeatRows.map((el) => {
                            const repeat = el.repeat;
                            if (!repeat)
                                return null;
                            const rows = samples[repeat.over];
                            const rowList = Array.isArray(rows) ? rows : [];
                            const fields = [...new Set(rowList.flatMap((r) => Object.keys(r)))];
                            const key = repeat.key ?? 'id';
                            const setRows = (next) => setSampleRows(repeat.over, next);
                            return (_jsxs("div", { className: styles.repeatBlock, "data-testid": `repeat-${classNameFor(el)}`, children: [_jsxs("div", { className: styles.repeatHeader, children: [_jsxs("button", { type: "button", className: styles.slotBadge, onClick: () => selectElement(el.id), title: "Select this element on the canvas", children: ["\u21BB ", elementLabel(el)] }), _jsxs("label", { className: styles.repeatField, children: ["list", _jsx("input", { className: styles.repeatInput, "aria-label": "List prop", defaultValue: repeat.over, spellCheck: false, onBlur: (e) => {
                                                            const next = e.target.value.trim();
                                                            if (next === repeat.over)
                                                                return;
                                                            if (validateBindingName(next, elements, rootId, otherNames(repeat.over)) !== null) {
                                                                e.target.value = repeat.over;
                                                                return;
                                                            }
                                                            renameBindingProp(repeat.over, next);
                                                        }, onKeyDown: (e) => { if (e.key === 'Enter')
                                                            e.currentTarget.blur(); } }, `over-${repeat.over}`)] }), _jsxs("label", { className: styles.repeatField, children: ["as", _jsx("input", { className: styles.repeatInput, "aria-label": "Row variable", defaultValue: repeat.as, spellCheck: false, onBlur: (e) => {
                                                            const next = e.target.value.trim();
                                                            if (next === repeat.as || !PROP_NAME_RE.test(next)) {
                                                                e.target.value = repeat.as;
                                                                return;
                                                            }
                                                            setRepeat(el.id, { ...repeat, as: next });
                                                        }, onKeyDown: (e) => { if (e.key === 'Enter')
                                                            e.currentTarget.blur(); } }, `as-${repeat.as}`)] }), _jsxs("label", { className: styles.repeatField, children: ["key", _jsx("select", { className: styles.repeatInput, "aria-label": "Row key", value: key, onChange: (e) => setRepeat(el.id, { ...repeat, key: e.target.value }), children: [...new Set(['id', ...fields])].map((f) => (_jsx("option", { value: f, children: f }, f))) })] }), _jsx("button", { type: "button", className: styles.smallButton, onClick: () => setRepeat(el.id, null), children: "Stop repeating" })] }), _jsxs("table", { className: styles.rowsTable, children: [_jsx("thead", { children: _jsxs("tr", { children: [fields.map((f) => _jsx("th", { children: f }, f)), _jsx("th", {})] }) }), _jsx("tbody", { children: rowList.map((row, i) => (_jsxs("tr", { children: [fields.map((f) => (_jsx("td", { children: _jsx("input", { className: styles.cellInput, "aria-label": `${repeat.over} row ${i + 1} ${f}`, defaultValue: String(row[f] ?? ''), onBlur: (e) => {
                                                                    const raw = e.target.value;
                                                                    const value = /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw;
                                                                    if (row[f] === value)
                                                                        return;
                                                                    setRows(rowList.map((r, j) => (j === i ? { ...r, [f]: value } : r)));
                                                                }, onKeyDown: (e) => { if (e.key === 'Enter')
                                                                    e.currentTarget.blur(); } }, `${i}-${f}-${String(row[f] ?? '')}`) }, f))), _jsx("td", { children: _jsx("button", { type: "button", className: styles.smallButton, "aria-label": `Remove ${repeat.over} row ${i + 1}`, onClick: () => setRows(rowList.filter((_, j) => j !== i)), children: "\u00D7" }) })] }, i))) })] }), _jsxs("div", { className: styles.repeatHeader, children: [_jsx("button", { type: "button", className: styles.smallButton, onClick: () => {
                                                    const blank = {};
                                                    for (const f of fields)
                                                        blank[f] = f === key ? String(rowList.length + 1) : '';
                                                    if (!(key in blank))
                                                        blank[key] = String(rowList.length + 1);
                                                    setRows([...rowList, blank]);
                                                }, children: "+ Row" }), _jsx(NameInput, { value: "", placeholder: "+ field", ariaLabel: `Add a field to ${repeat.over}`, validate: (f) => (FIELD_NAME_RE.test(f) ? (fields.includes(f) ? 'Already a field.' : null) : 'Use a plain field name.'), onCommit: (f) => {
                                                    const base = rowList.length > 0 ? rowList : [{ [key]: '1' }];
                                                    setRows(base.map((r) => ({ ...r, [f]: '' })));
                                                } })] })] }, el.id));
                        }) })] })), showRows.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.sectionTitle, children: "Show" }), _jsx("div", { className: styles.rows, children: showRows.map((el) => {
                            const flag = el.showIf ?? '';
                            const name = bindPropName(flag);
                            const sample = samples[name];
                            return (_jsxs("div", { className: styles.row, "data-testid": `show-${classNameFor(el)}`, children: [_jsxs("button", { type: "button", className: styles.slotBadge, onClick: () => selectElement(el.id), title: "Select this element on the canvas", children: ["\uD83D\uDC41 ", elementLabel(el)] }), _jsx(NameInput, { value: flag, ariaLabel: "Show when prop", validate: (n) => validateBindingName(bindPropName(n), elements, el.id, otherNames(name)), onCommit: (n) => {
                                            if (isRowPath(bindPropName(n)))
                                                setShowIf(el.id, n);
                                            else
                                                renameBindingProp(name, bindPropName(n));
                                        } }), !isRowPath(name) && (_jsxs("label", { className: styles.invertLabel, children: [_jsx("input", { type: "checkbox", "aria-label": `${name} sample`, checked: typeof sample === 'boolean' ? sample : true, onChange: (e) => setSampleFlag(name, e.target.checked) }), "on"] })), _jsx("button", { type: "button", className: styles.smallButton, onClick: () => setShowIf(el.id, null), children: "Always show" })] }, el.id));
                        }) })] })), attributeRows.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.sectionTitle, children: "Attributes" }), _jsx("div", { className: styles.rows, children: attributeRows.map(({ el, attr, expr }) => {
                            const bound = expr !== undefined;
                            const name = expr !== undefined ? bindPropName(expr) : '';
                            const boolean = isBooleanAttribute(el, attr);
                            return (_jsxs("div", { className: styles.row, "data-testid": `attr-${classNameFor(el)}-${attr}`, children: [_jsxs("div", { className: styles.bindingLabel, children: [_jsx("span", { className: styles.bindingElement, children: elementLabel(el) }), _jsx("code", { className: styles.bindingName, children: attr })] }), _jsx(SegmentedControl, { value: bound ? 'prop' : 'locked', options: LOCKED_PROP, onChange: (next) => {
                                            if ((next === 'prop') === bound)
                                                return;
                                            setAttributeBinding(el.id, attr, next === 'prop' ? freePropName(attr === 'href' ? 'url' : attr, propNames) : null);
                                        } }), bound && (_jsxs(_Fragment, { children: [_jsx(NameInput, { value: name, ariaLabel: `${attr} prop name`, validate: (n) => validateBindingName(n, elements, el.id, otherNames(name)), onCommit: (n) => setAttributeBinding(el.id, attr, n, isInvertedBinding(expr ?? '')) }), boolean && (_jsxs("label", { className: styles.invertLabel, children: [_jsx("input", { type: "checkbox", "aria-label": `Invert ${attr}`, checked: isInvertedBinding(expr ?? ''), onChange: (e) => setAttributeBinding(el.id, attr, name, e.target.checked) }), "inverted"] }))] }))] }, `${el.id}:${attr}`));
                        }) })] })), eventRows.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.sectionTitle, children: "Events" }), _jsx("div", { className: styles.rows, children: eventRows.map(({ el, event, handler }) => (_jsxs("div", { className: styles.row, "data-testid": `event-${classNameFor(el)}-${event}`, children: [_jsxs("div", { className: styles.bindingLabel, children: [_jsx("span", { className: styles.bindingElement, children: elementLabel(el) }), _jsx("code", { className: styles.bindingName, children: event })] }), _jsx(SegmentedControl, { value: handler !== undefined ? 'prop' : 'none', options: NONE_PROP, onChange: (next) => {
                                        if ((next === 'prop') === (handler !== undefined))
                                            return;
                                        setEventBinding(el.id, event, next === 'prop' ? freePropName(event, propNames) : null);
                                    } }), handler !== undefined && (_jsx(NameInput, { value: handler, ariaLabel: `${event} handler name`, validate: (n) => (PROP_NAME_RE.test(n) ? (otherNames(handler).includes(n) ? 'Already used by another prop.' : null) : 'Use lowerCamelCase letters / digits only.'), onCommit: (n) => setEventBinding(el.id, event, n) }))] }, `${el.id}:${event}`))) })] }))] }));
};
