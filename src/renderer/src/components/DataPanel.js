import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { SegmentedControl } from './controls/SegmentedControl';
import { REQUEST_REMOVE_SLOT_EVENT, } from './ElementContextMenu';
import styles from './DataPanel.module.css';
import propStyles from './PropertiesPanel.module.css';
// Data tab: component-only prop/locked toggle + per-instance overrides.
// see docs/notes/components-data-model.md
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
/** Prop→Locked toggle dispatch; ProjectShell decides whether to warn. */
export const REQUEST_LOCK_PROP_EVENT = 'scamp:request-lock-prop';
const collectTextDescendants = (elements, rootId) => {
    const rows = [];
    const walk = (id) => {
        const el = elements[id];
        if (!el)
            return;
        if (el.type === 'text' && id !== rootId) {
            rows.push({ id, text: el.text ?? '', prop: el.prop });
        }
        for (const childId of el.childIds)
            walk(childId);
    };
    walk(rootId);
    return rows;
};
const TOGGLE_OPTIONS = [
    { value: 'locked', label: 'Locked' },
    { value: 'prop', label: 'Prop' },
];
const collectSlotRows = (elements, rootId) => {
    const rows = [];
    const walk = (id) => {
        const el = elements[id];
        if (!el)
            return;
        if (typeof el.slot === 'string' && el.slot.length > 0) {
            rows.push({ id, slot: el.slot });
        }
        for (const childId of el.childIds)
            walk(childId);
    };
    walk(rootId);
    return rows;
};
/** One slot row: a rename input + a "Remove" affordance. Slots are the
 *  `children`/`ReactNode` analog of text props. */
const SlotRow = ({ row, otherSlotNames, }) => {
    const renameSlot = useCanvasStore((s) => s.renameSlot);
    const toggleSlotOnRect = useCanvasStore((s) => s.toggleSlotOnRect);
    const selectElement = useCanvasStore((s) => s.selectElement);
    const activeComponentName = useCanvasStore((s) => s.activeComponent?.name ?? null);
    const [draftName, setDraftName] = useState(row.slot);
    const [validationError, setValidationError] = useState(null);
    useEffect(() => {
        setDraftName(row.slot);
    }, [row.slot]);
    const commitRename = () => {
        const next = draftName.trim();
        if (next === row.slot) {
            setValidationError(null);
            return;
        }
        if (!PROP_NAME_RE.test(next)) {
            setValidationError('Use a lowercase identifier (e.g. header).');
            return;
        }
        if (otherSlotNames.includes(next)) {
            setValidationError('Slot names must be unique.');
            return;
        }
        setValidationError(null);
        renameSlot(row.id, next);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter')
            e.currentTarget.blur();
        if (e.key === 'Escape') {
            setDraftName(row.slot);
            setValidationError(null);
            e.currentTarget.blur();
        }
    };
    return (_jsxs("div", { className: styles.row, children: [_jsx("button", { type: "button", className: styles.slotBadge, onClick: () => selectElement(row.id), title: "Select this slot on the canvas", children: "\u2726 slot" }), _jsxs("div", { className: styles.renameWrap, children: [_jsx("input", { className: styles.renameInput, type: "text", value: draftName, onChange: (e) => setDraftName(e.target.value), onBlur: commitRename, onKeyDown: handleKeyDown, spellCheck: false, "aria-label": "Slot name" }), validationError && (_jsx("div", { className: styles.renameError, children: validationError }))] }), _jsx("button", { type: "button", className: styles.slotRemove, onClick: () => {
                    // Route through ProjectShell so it can warn when instances on other
                    // pages have content in this slot. see component-slots-plan.md
                    if (activeComponentName === null) {
                        toggleSlotOnRect(row.id);
                        return;
                    }
                    window.dispatchEvent(new CustomEvent(REQUEST_REMOVE_SLOT_EVENT, {
                        detail: {
                            elementId: row.id,
                            componentName: activeComponentName,
                            slotName: row.slot,
                        },
                    }));
                }, title: "Remove slot", children: "Remove" })] }));
};
const DataRow = ({ row, otherPropNames, }) => {
    const togglePropOnText = useCanvasStore((s) => s.togglePropOnText);
    const renamePropOnText = useCanvasStore((s) => s.renamePropOnText);
    const activeComponentName = useCanvasStore((s) => s.activeComponent?.name ?? null);
    const [draftName, setDraftName] = useState(row.prop ?? '');
    const inputRef = useRef(null);
    // Resync draft when prop changes externally (undo, reload).
    useEffect(() => {
        setDraftName(row.prop ?? '');
    }, [row.prop]);
    const isProp = row.prop !== undefined;
    const validationError = (() => {
        if (!isProp)
            return null;
        if (draftName === row.prop)
            return null;
        if (!PROP_NAME_RE.test(draftName)) {
            return 'Use lowerCamelCase letters / digits only.';
        }
        if (otherPropNames.includes(draftName)) {
            return 'Already used by another prop.';
        }
        return null;
    })();
    const commitRename = () => {
        if (!isProp)
            return;
        if (draftName === row.prop)
            return;
        if (validationError)
            return;
        renamePropOnText(row.id, draftName);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitRename();
            inputRef.current?.blur();
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            setDraftName(row.prop ?? '');
            inputRef.current?.blur();
        }
    };
    return (_jsxs("div", { className: styles.row, children: [_jsx("div", { className: styles.preview, title: row.text || '(empty)', children: row.text.length > 0 ? row.text : _jsx("em", { className: styles.emptyText, children: "(empty)" }) }), _jsx(SegmentedControl, { value: isProp ? 'prop' : 'locked', options: TOGGLE_OPTIONS, onChange: (next) => {
                    if ((next === 'prop') === isProp)
                        return;
                    if (next === 'prop') {
                        togglePropOnText(row.id);
                        return;
                    }
                    // Prop → Locked may warn cross-page; defer to ProjectShell.
                    if (!activeComponentName || !row.prop) {
                        togglePropOnText(row.id);
                        return;
                    }
                    window.dispatchEvent(new CustomEvent(REQUEST_LOCK_PROP_EVENT, {
                        detail: {
                            elementId: row.id,
                            componentName: activeComponentName,
                            propName: row.prop,
                        },
                    }));
                } }), isProp && (_jsxs("div", { className: styles.renameWrap, children: [_jsx("input", { ref: inputRef, className: styles.renameInput, type: "text", value: draftName, onChange: (e) => setDraftName(e.target.value), onBlur: commitRename, onKeyDown: handleKeyDown, spellCheck: false, "aria-label": "Prop name" }), validationError && (_jsx("div", { className: styles.renameError, children: validationError }))] }))] }));
};
/** Component-editor: list text descendants with prop/locked toggle. */
const ComponentDataView = () => {
    const elements = useCanvasStore((s) => s.elements);
    const rootElementId = useCanvasStore((s) => s.rootElementId);
    const rows = useMemo(() => collectTextDescendants(elements, rootElementId), [elements, rootElementId]);
    // For each row's rename validator: every OTHER row's prop name.
    // Precomputing once means the rows don't each rebuild the same
    // set on every keystroke.
    const allPropNames = useMemo(() => rows.flatMap((r) => (r.prop !== undefined ? [r.prop] : [])), [rows]);
    const slotRows = useMemo(() => collectSlotRows(elements, rootElementId), [elements, rootElementId]);
    const allSlotNames = useMemo(() => slotRows.map((r) => r.slot), [slotRows]);
    if (rows.length === 0 && slotRows.length === 0) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsx("div", { className: styles.empty, children: "No text props or slots yet. Mark a text element as a prop, or right-click a rectangle \u2192 \"Make slot\" to let pages nest content inside this component." }) }));
    }
    return (_jsxs("div", { className: propStyles.uiPanelBody, children: [rows.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.intro, children: "Mark a text element as a prop to let pages override its content per-instance. Locked text stays the same on every instance." }), _jsx("div", { className: styles.rows, children: rows.map((row) => (_jsx(DataRow, { row: row, otherPropNames: allPropNames.filter((n) => n !== row.prop) }, row.id))) })] })), slotRows.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.intro, children: ["Slots let pages nest their own elements inside this component (React ", _jsx("code", { children: "children" }), "). Rename or remove them here."] }), _jsx("div", { className: styles.rows, children: slotRows.map((row) => (_jsx(SlotRow, { row: row, otherSlotNames: allSlotNames.filter((n) => n !== row.slot) }, row.id))) })] }))] }));
};
const collectPropDeclarations = (elements, rootId) => {
    const out = [];
    const seen = new Set();
    const walk = (id) => {
        const el = elements[id];
        if (!el)
            return;
        if (el.type === 'text' &&
            typeof el.prop === 'string' &&
            el.prop.length > 0 &&
            !seen.has(el.prop)) {
            seen.add(el.prop);
            out.push({ name: el.prop, defaultText: el.text ?? '' });
        }
        for (const childId of el.childIds)
            walk(childId);
    };
    walk(rootId);
    return out;
};
/**
 * One row of the instance-side Data tab: prop name label + a
 * textarea bound to the override (or the component default when
 * no override is set). A "Reset" button surfaces only when an
 * override exists, so the row visually distinguishes
 * "overridden" from "showing default".
 */
const InstanceRow = ({ instanceId, declaration, overrideValue, }) => {
    const setPropOverride = useCanvasStore((s) => s.setPropOverride);
    const clearPropOverride = useCanvasStore((s) => s.clearPropOverride);
    // Draft committed on blur — avoids one history entry per keystroke.
    const initial = overrideValue ?? declaration.defaultText;
    const [draft, setDraft] = useState(initial);
    useEffect(() => {
        setDraft(overrideValue ?? declaration.defaultText);
    }, [overrideValue, declaration.defaultText]);
    const isOverridden = overrideValue !== undefined;
    const commit = () => {
        if (draft === initial)
            return;
        setPropOverride(instanceId, declaration.name, draft);
    };
    return (_jsxs("div", { className: styles.row, children: [_jsxs("div", { className: styles.propLabelRow, children: [_jsx("code", { className: styles.propName, children: declaration.name }), isOverridden && (_jsx("button", { type: "button", className: styles.resetButton, onClick: () => clearPropOverride(instanceId, declaration.name), "aria-label": `Reset ${declaration.name} to component default`, children: "Reset" }))] }), _jsx("textarea", { className: styles.overrideInput, value: draft, onChange: (e) => setDraft(e.target.value), onBlur: commit, rows: 2, spellCheck: false, "aria-label": `Override value for ${declaration.name}` })] }));
};
/** Page-side: one row per declared prop of the selected instance. */
const InstanceDataView = () => {
    const instance = useCanvasStore((s) => {
        const selectedId = s.selectedElementIds[0];
        if (!selectedId)
            return null;
        const el = s.elements[selectedId];
        return el && el.type === 'component-instance' ? el : null;
    });
    const componentTree = useCanvasStore((s) => {
        const name = instance?.componentName;
        if (!name)
            return undefined;
        return s.componentTrees[name];
    });
    const declarations = useMemo(() => {
        if (!componentTree)
            return [];
        return collectPropDeclarations(componentTree.elements, componentTree.rootId);
    }, [componentTree]);
    // The component's declared slots (rectangles with a `slot` marker).
    const slotNames = useMemo(() => {
        if (!componentTree)
            return [];
        return Object.values(componentTree.elements)
            .filter((e) => typeof e.slot === 'string' && e.slot.length > 0)
            .map((e) => e.slot);
    }, [componentTree]);
    // Count how much content the instance has placed in each slot.
    const elements = useCanvasStore((s) => s.elements);
    const slotCounts = useMemo(() => {
        const counts = new Map();
        for (const name of slotNames)
            counts.set(name, 0);
        const single = slotNames.length === 1;
        for (const id of instance?.childIds ?? []) {
            const child = elements[id];
            const eff = child?.slotName && child.slotName.length > 0 ? child.slotName : 'children';
            const target = single ? slotNames[0] : eff;
            if (counts.has(target))
                counts.set(target, (counts.get(target) ?? 0) + 1);
        }
        return counts;
    }, [slotNames, instance?.childIds, elements]);
    if (!instance) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsx("div", { className: styles.empty, children: "Select a component on the canvas." }) }));
    }
    if (declarations.length === 0 && slotNames.length === 0) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsxs("div", { className: styles.empty, children: [instance.componentName ?? 'This component', " has no props or slots. Open the component editor to add them."] }) }));
    }
    const overrides = instance.propOverrides ?? {};
    return (_jsxs("div", { className: propStyles.uiPanelBody, children: [declarations.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.intro, children: ["Override the text content of this ", instance.componentName, " instance. Empty an override and Reset to restore the component default."] }), _jsx("div", { className: styles.rows, children: declarations.map((decl) => (_jsx(InstanceRow, { instanceId: instance.id, declaration: decl, overrideValue: Object.prototype.hasOwnProperty.call(overrides, decl.name)
                                ? overrides[decl.name]
                                : undefined }, decl.name))) })] })), slotNames.length > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { className: styles.intro, children: "Slots \u2014 drag elements onto this instance's slot areas on the canvas to fill them." }), _jsx("div", { className: styles.rows, children: slotNames.map((name) => {
                            const count = slotCounts.get(name) ?? 0;
                            return (_jsxs("div", { className: styles.row, children: [_jsxs("span", { className: styles.slotBadge, children: ["\u2726 ", name] }), _jsx("span", { style: {
                                            fontSize: 12,
                                            color: count > 0
                                                ? 'var(--text-primary)'
                                                : 'var(--text-secondary)',
                                        }, children: count > 0
                                            ? `● ${count} element${count === 1 ? '' : 's'}`
                                            : '○ Empty' })] }, name));
                        }) })] }))] }));
};
export const DataPanel = () => {
    const isComponentEditing = useCanvasStore((s) => s.activeComponent !== null);
    return isComponentEditing ? _jsx(ComponentDataView, {}) : _jsx(InstanceDataView, {});
};
