import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasSlice';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './DataPanel.module.css';
import propStyles from './PropertiesPanel.module.css';
/**
 * Component-only panel that lists every text descendant of the
 * component root with a Prop / Locked toggle and an inline rename
 * input for prop names. Renders inside `PropertiesPanel` when the
 * panel mode is `'data'`.
 *
 * "Data" here means "what gets parameterised when an instance is
 * placed on a page". Other style properties (colour, padding, etc.)
 * always belong to the component; only text content is per-instance
 * overridable. That's why this is a flat list of text elements
 * rather than a property editor.
 *
 * Page-side equivalent doesn't exist: this whole tab is hidden on
 * pages (see `PanelModeToggle`).
 */
const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
/**
 * Phase 7 hook: when the user toggles a prop-text element from
 * Prop → Locked, DataPanel dispatches this event instead of
 * calling `togglePropOnText` directly. `ProjectShell` listens,
 * walks every page to find instances with an override for the
 * named prop, and either runs the toggle silently (no overrides
 * at risk) or surfaces a ConfirmDialog with the impact info.
 */
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
/**
 * Single row in the Data tab — text preview, Prop/Locked toggle,
 * and an inline rename input when Prop is active.
 *
 * Validation: the rename input only commits when the name is a
 * valid JS identifier (lowercased start) AND unique among the
 * other text elements' prop names. Invalid input surfaces inline
 * red text; the toggle stays operable.
 */
const DataRow = ({ row, otherPropNames, }) => {
    const togglePropOnText = useCanvasStore((s) => s.togglePropOnText);
    const renamePropOnText = useCanvasStore((s) => s.renamePropOnText);
    // Used to send the active component name with the
    // lock-prop request — ProjectShell needs it to filter
    // page-instance matches.
    const activeComponentName = useCanvasStore((s) => s.activeComponent?.name ?? null);
    const [draftName, setDraftName] = useState(row.prop ?? '');
    const inputRef = useRef(null);
    // Reset the draft when the canonical prop name changes from
    // outside (e.g. an undo, a file reload). Prevents the input from
    // showing a stale or out-of-sync value.
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
                    // No-op when the requested value matches current state —
                    // avoids a history entry on accidental same-state clicks.
                    if ((next === 'prop') === isProp)
                        return;
                    // Locked → Prop: always safe. Just commit.
                    if (next === 'prop') {
                        togglePropOnText(row.id);
                        return;
                    }
                    // Prop → Locked: defer to ProjectShell so it can compute
                    // cross-page impact and (if instances would lose
                    // overrides) confirm before the toggle commits. When no
                    // active component is known we fall back to the silent
                    // toggle — that path shouldn't happen since Lock is only
                    // available inside a component editor, but the defensive
                    // fallback keeps the UI responsive if state desyncs.
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
/**
 * Component-editor view: list every text descendant of the
 * component root with the Prop/Locked toggle. Same shape as the
 * Phase 5 implementation.
 */
const ComponentDataView = () => {
    const elements = useCanvasStore((s) => s.elements);
    const rootElementId = useCanvasStore((s) => s.rootElementId);
    const rows = useMemo(() => collectTextDescendants(elements, rootElementId), [elements, rootElementId]);
    // For each row's rename validator: every OTHER row's prop name.
    // Precomputing once means the rows don't each rebuild the same
    // set on every keystroke.
    const allPropNames = useMemo(() => rows.flatMap((r) => (r.prop !== undefined ? [r.prop] : [])), [rows]);
    if (rows.length === 0) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsx("div", { className: styles.empty, children: "No text elements in this component yet. Add a text element on the canvas, then return to this tab to mark it as a prop." }) }));
    }
    return (_jsxs("div", { className: propStyles.uiPanelBody, children: [_jsx("div", { className: styles.intro, children: "Mark a text element as a prop to let pages override its content per-instance. Locked text stays the same on every instance." }), _jsx("div", { className: styles.rows, children: rows.map((row) => (_jsx(DataRow, { row: row, otherPropNames: allPropNames.filter((n) => n !== row.prop) }, row.id))) })] }));
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
    // Local draft tracks the in-flight edit so typing doesn't fight
    // the upstream store update on every keystroke. We commit on blur
    // — matches the inline canvas editor's behaviour and avoids a
    // history entry per character.
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
/**
 * Instance-selected view: the user is on a page with a
 * component-instance selected. Show one row per declared prop of
 * that component, each bound to `propOverrides[name]` (or the
 * component-side default when no override is set).
 */
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
    if (!instance) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsx("div", { className: styles.empty, children: "Select a component on the canvas." }) }));
    }
    if (declarations.length === 0) {
        return (_jsx("div", { className: propStyles.uiPanelBody, children: _jsxs("div", { className: styles.empty, children: [instance.componentName ?? 'This component', " has no declared props. Open the component editor and toggle a text element to Prop to add one."] }) }));
    }
    const overrides = instance.propOverrides ?? {};
    return (_jsxs("div", { className: propStyles.uiPanelBody, children: [_jsxs("div", { className: styles.intro, children: ["Override the text content of this ", instance.componentName, " instance. Empty an override and Reset to restore the component default."] }), _jsx("div", { className: styles.rows, children: declarations.map((decl) => (_jsx(InstanceRow, { instanceId: instance.id, declaration: decl, overrideValue: Object.prototype.hasOwnProperty.call(overrides, decl.name)
                        ? overrides[decl.name]
                        : undefined }, decl.name))) })] }));
};
/**
 * Top-level Data tab. Branches between the component-editor view
 * (Phase 5: declare props) and the instance-selected-on-page view
 * (Phase 6: override per-instance values).
 */
export const DataPanel = () => {
    const isComponentEditing = useCanvasStore((s) => s.activeComponent !== null);
    return isComponentEditing ? _jsx(ComponentDataView, {}) : _jsx(InstanceDataView, {});
};
