import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { DEFAULT_TAG, TAG_ATTRIBUTES, TAG_OPTIONS, } from '@lib/elementTags';
import { EnumSelect } from '../controls/EnumSelect';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { Section, Row } from './Section';
import styles from './ElementSection.module.css';
/**
 * Collapsible "Element" section that appears at the top of the
 * properties panel for every element type. Lets the user pick the
 * element's HTML tag and edit tag-specific attributes (href, method,
 * etc.). For `<select>` and `<svg>` the section renders a dedicated
 * editor instead of a plain attribute form.
 */
export const ElementSection = ({ elementId }) => {
    const element = useCanvasStore((s) => s.elements[elementId]);
    const patchElement = useCanvasStore((s) => s.patchElement);
    if (!element)
        return null;
    const tagOptions = TAG_OPTIONS[element.type];
    const currentTag = element.tag ?? DEFAULT_TAG[element.type];
    const handleTagChange = (nextTag) => {
        // Storing `undefined` when the user picks the type's default tag
        // keeps the round-trip text-stable — matches parseCode's rule.
        patchElement(elementId, {
            tag: nextTag === DEFAULT_TAG[element.type] ? undefined : nextTag,
        });
    };
    return (_jsxs(Section, { title: "Element", collapsible: true, defaultOpen: true, children: [_jsx(Row, { label: "Tag", children: _jsx(EnumSelect, { value: currentTag, options: tagOptions, onChange: handleTagChange, title: "HTML tag" }) }), currentTag === 'select' ? (_jsx(SelectOptionsEditor, { elementId: elementId, element: element })) : currentTag === 'svg' ? (_jsx(SvgSourceEditor, { elementId: elementId, element: element })) : (_jsx(AttributeFields, { elementId: elementId, attributes: element.attributes ?? {}, specs: TAG_ATTRIBUTES[currentTag] ?? [] }))] }));
};
const AttributeFields = ({ elementId, attributes, specs, }) => {
    const patchElement = useCanvasStore((s) => s.patchElement);
    if (specs.length === 0)
        return null;
    const setAttr = (name, value) => {
        const next = { ...attributes };
        if (value === null)
            delete next[name];
        else
            next[name] = value;
        patchElement(elementId, {
            attributes: Object.keys(next).length > 0 ? next : undefined,
        });
    };
    return (_jsx(_Fragment, { children: specs.map((spec) => {
            const current = attributes[spec.name] ?? '';
            if (spec.kind === 'text') {
                return (_jsx(Row, { label: spec.label, children: _jsx(PrefixSuffixInput, { value: current, placeholder: spec.placeholder, onCommit: (next) => setAttr(spec.name, next === '' ? null : next) }) }, spec.name));
            }
            if (spec.kind === 'select') {
                // If the current stored value isn't in the option set, prepend
                // an empty option so the select has something to show.
                return (_jsx(Row, { label: spec.label, children: _jsx(EnumSelect, { value: current, options: [{ value: '', label: '(default)' }, ...spec.options], onChange: (value) => setAttr(spec.name, value === '' ? null : value) }) }, spec.name));
            }
            // boolean — stored as "" when checked, absent when not
            const checked = spec.name in attributes;
            return (_jsx(Row, { label: spec.label, children: _jsxs("label", { className: styles.boolRow, children: [_jsx("input", { type: "checkbox", checked: checked, onChange: (e) => setAttr(spec.name, e.target.checked ? '' : null) }), _jsx("span", { children: checked ? 'Yes' : 'No' })] }) }, spec.name));
        }) }));
};
const SelectOptionsEditor = ({ elementId, element }) => {
    const patchElement = useCanvasStore((s) => s.patchElement);
    const options = element.selectOptions ?? [];
    const update = (next) => {
        patchElement(elementId, { selectOptions: next.length > 0 ? next : undefined });
    };
    const addOption = () => {
        update([...options, { value: '', label: 'New option' }]);
    };
    const patchOption = (idx, patch) => {
        const next = options.map((opt, i) => (i === idx ? { ...opt, ...patch } : opt));
        update(next);
    };
    const removeOption = (idx) => {
        update(options.filter((_, i) => i !== idx));
    };
    const toggleSelected = (idx) => {
        const next = options.map((opt, i) => {
            if (i === idx)
                return { ...opt, selected: !opt.selected };
            if (opt.selected) {
                // Only one option can be initially selected at a time (matches
                // the single-select UI the story describes).
                const clone = { ...opt };
                delete clone.selected;
                return clone;
            }
            return opt;
        });
        update(next);
    };
    return (_jsxs("div", { className: styles.optionsEditor, children: [_jsx("div", { className: styles.optionsHeader, children: "Options" }), options.length === 0 && (_jsx("div", { className: styles.optionsEmpty, children: "No options yet." })), options.map((opt, idx) => (_jsxs("div", { className: styles.optionRow, children: [_jsx(PrefixSuffixInput, { value: opt.value, placeholder: "value", onCommit: (next) => patchOption(idx, { value: next }) }), _jsx(PrefixSuffixInput, { value: opt.label, placeholder: "label", onCommit: (next) => patchOption(idx, { label: next }) }), _jsx("button", { type: "button", className: `${styles.pill} ${opt.selected ? styles.pillActive : ''}`, onClick: () => toggleSelected(idx), title: "Initially selected", children: "\u2713" }), _jsx("button", { type: "button", className: styles.iconButton, onClick: () => removeOption(idx), "aria-label": "Remove option", children: "\u00D7" })] }, idx))), _jsx("button", { type: "button", className: styles.addRow, onClick: addOption, children: "+ Add option" })] }));
};
const SvgSourceEditor = ({ elementId, element }) => {
    const patchElement = useCanvasStore((s) => s.patchElement);
    const source = element.svgSource ?? '';
    const handleChange = (value) => {
        patchElement(elementId, { svgSource: value.length > 0 ? value : undefined });
    };
    return (_jsxs("div", { className: styles.svgEditor, children: [_jsx("div", { className: styles.optionsHeader, children: "Inner source" }), _jsx("textarea", { className: styles.textarea, value: source, spellCheck: false, rows: 6, placeholder: '<circle cx="50" cy="50" r="40" fill="currentColor" />', onChange: (e) => handleChange(e.target.value) })] }));
};
