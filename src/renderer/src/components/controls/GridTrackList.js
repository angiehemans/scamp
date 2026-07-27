import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconPlus, IconX, } from '@tabler/icons-react';
import { parseGridTemplate, serializeGridTemplate, } from '@lib/gridTemplate';
import { EnumSelect } from './EnumSelect';
import { NumberInput } from './NumberInput';
import { PrefixSuffixInput } from './PrefixSuffixInput';
import styles from './GridTemplateEditor.module.css';
const TYPE_OPTIONS = [
    { value: 'fr', label: 'Fr' },
    { value: 'px', label: 'Px' },
    { value: 'percent', label: '%' },
    { value: 'auto', label: 'Auto' },
    { value: 'min-content', label: 'Min' },
    { value: 'max-content', label: 'Max' },
    { value: 'raw', label: 'Custom' },
];
const defaultTrack = (type) => {
    switch (type) {
        case 'fr':
            return { kind: 'fr', value: 1 };
        case 'px':
            return { kind: 'px', value: 100 };
        case 'percent':
            return { kind: 'percent', value: 25 };
        case 'auto':
            return { kind: 'auto' };
        case 'min-content':
            return { kind: 'min-content' };
        case 'max-content':
            return { kind: 'max-content' };
        case 'raw':
            return { kind: 'raw', source: 'minmax(100px, 1fr)' };
    }
};
const renderValue = (track, update) => {
    if (track.kind === 'fr' || track.kind === 'px' || track.kind === 'percent') {
        const suffix = track.kind === 'fr' ? 'fr' : track.kind === 'px' ? 'px' : '%';
        return (_jsx(NumberInput, { value: track.value, onChange: (v) => {
                if (v !== undefined)
                    update({ ...track, value: v });
            }, min: 0, suffix: suffix, title: "Track size" }));
    }
    if (track.kind === 'raw') {
        return (_jsx(PrefixSuffixInput, { value: track.source, onCommit: (v) => update({ kind: 'raw', source: v.trim() }), title: "Custom track value" }));
    }
    // auto / min-content / max-content have no numeric value.
    return null;
};
/**
 * Collapsible per-track editor for one grid axis: a chip per track
 * (type + size), add/remove, and a proportional preview — tucked into
 * an accordion so a many-track grid stays compact. Falls back to a
 * plain text field when the template is too complex to model as a flat
 * track list (`parseGridTemplate` → null).
 */
export const GridTrackList = ({ label, template, onChange, }) => {
    const [open, setOpen] = useState(false);
    const tracks = parseGridTemplate(template);
    const singular = label.toLowerCase().replace(/s$/, '');
    const countLabel = tracks === null ? 'custom' : String(tracks.length);
    const renderTracks = (list) => {
        const commit = (next) => onChange(serializeGridTemplate(next));
        const updateAt = (i, track) => commit(list.map((t, idx) => (idx === i ? track : t)));
        const removeAt = (i) => commit(list.filter((_, idx) => idx !== i));
        const add = () => commit([...list, { kind: 'fr', value: 1 }]);
        const serialized = serializeGridTemplate(list);
        return (_jsxs(_Fragment, { children: [list.map((track, i) => (
                // eslint-disable-next-line react/no-array-index-key -- tracks are positional
                _jsxs("div", { className: styles.track, children: [_jsx("span", { className: styles.trackIndex, children: i + 1 }), _jsx("div", { className: styles.trackType, children: _jsx(EnumSelect, { value: track.kind, options: TYPE_OPTIONS, onChange: (type) => updateAt(i, defaultTrack(type)), title: "Track type" }) }), _jsx("div", { className: styles.trackValue, children: renderValue(track, (next) => updateAt(i, next)) }), _jsx("button", { type: "button", className: styles.iconButton, "aria-label": `Remove ${singular} ${i + 1}`, onClick: () => removeAt(i), children: _jsx(IconX, { size: 14 }) })] }, i))), _jsxs("button", { type: "button", className: styles.addButton, onClick: add, children: [_jsx(IconPlus, { size: 13 }), " Add ", singular] }), list.length > 0 && (_jsx("div", { className: styles.preview, style: { gridTemplateColumns: serialized }, "aria-hidden": true, children: list.map((_, i) => (
                    // eslint-disable-next-line react/no-array-index-key -- positional preview cells
                    _jsx("span", { className: styles.previewCell }, i))) }))] }));
    };
    return (_jsxs("div", { className: styles.trackList, children: [_jsxs("button", { type: "button", className: styles.accordionHeader, "aria-label": label, "aria-expanded": open, onClick: () => setOpen((o) => !o), children: [open ? (_jsx(IconChevronDown, { size: 13 })) : (_jsx(IconChevronRight, { size: 13 })), _jsx("span", { className: styles.trackHeader, children: label }), _jsx("span", { className: styles.accordionCount, children: countLabel })] }), open &&
                (tracks === null ? (_jsxs("div", { className: styles.fallback, children: [_jsx(PrefixSuffixInput, { value: template, onCommit: (v) => onChange(v.trim()), title: `${label} template` }), _jsx("span", { className: styles.fallbackNote, children: "Complex template \u2014 editing as text." })] })) : (renderTracks(tracks)))] }));
};
