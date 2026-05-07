import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { useCanvasStore } from '@store/canvasSlice';
import { useBreakpointOverrideFields, useStateOverrideFields, } from '@store/useResolvedElement';
import { Tooltip } from '../controls/Tooltip';
import styles from './Section.module.css';
/**
 * Card-like wrapper for one panel section. Renders a small heading
 * (optionally collapsible) and the provided controls.
 *
 * When `elementId` + `fields` are provided, the title surfaces an
 * override indicator that aggregates all breakpoint overrides within
 * this section. Right-click the dot to reset every overridden field
 * in the section at the active breakpoint.
 */
export const Section = ({ title, children, collapsible = false, defaultOpen = true, elementId, fields, cssProperties, }) => {
    const [open, setOpen] = useState(defaultOpen);
    const overrideInfo = useOverrideIndicator(elementId, fields);
    const duplicateInfo = useDuplicateIndicator(elementId, cssProperties);
    // Pick the tooltip whose header / body wraps the title row when an
    // indicator is active. Duplicates take priority because they signal
    // a bug-shaped condition the user probably wants to investigate
    // before tweaking overrides. When both are active, the override dot
    // is still rendered (and right-clickable to reset) but its tooltip
    // doesn't claim the wider title-row hit area.
    const tooltipInfo = duplicateInfo ?? overrideInfo;
    const duplicateDot = duplicateInfo ? (_jsx("span", { className: styles.duplicateDot, "aria-label": duplicateInfo.ariaLabel, "data-testid": "duplicate-dot" })) : null;
    const overrideDot = overrideInfo ? (_jsx("span", { className: styles.overrideDot, onContextMenu: overrideInfo.onContextMenu, "aria-label": overrideInfo.ariaLabel, "data-testid": "override-dot" })) : null;
    const wrapWithTooltip = (node) => {
        if (!tooltipInfo)
            return node;
        return (_jsx(Tooltip, { header: tooltipInfo.header, label: tooltipInfo.label, children: node }));
    };
    if (!collapsible) {
        return (_jsxs("section", { className: styles.section, "data-panel-section": title, children: [wrapWithTooltip(_jsxs("div", { className: styles.titleRow, children: [_jsx("h3", { className: styles.heading, children: title }), duplicateDot, overrideDot] })), children] }));
    }
    const handleToggle = () => setOpen((v) => !v);
    return (_jsxs("section", { className: styles.section, "data-panel-section": title, children: [wrapWithTooltip(_jsxs("button", { className: styles.toggle, type: "button", onClick: handleToggle, "aria-expanded": open, children: [_jsx("span", { className: styles.heading, children: title }), duplicateDot, overrideDot, _jsx(IconChevronDown, { size: 14, stroke: 2, className: `${styles.caret} ${open ? '' : styles.caretCollapsed}`, "aria-hidden": "true" })] })), open && children] }));
};
/**
 * Yellow warning state for a section title — fires when the parser
 * saw any of this section's CSS properties declared more than once
 * in the element's class block. Editing any field in this section
 * (or anywhere on the element) rewrites the class block and clears
 * the duplicate, so the indicator self-heals on the next user
 * interaction.
 *
 * Returns the tooltip data so the section can hoist the hover hit
 * area onto the whole title row rather than just a tiny dot.
 */
const useDuplicateIndicator = (elementId, cssProperties) => {
    const duplicateProps = useCanvasStore((s) => elementId ? s.cssDuplicates[elementId] ?? null : null);
    if (!elementId || !cssProperties || cssProperties.length === 0)
        return null;
    if (!duplicateProps || duplicateProps.length === 0)
        return null;
    const matched = cssProperties.filter((p) => duplicateProps.includes(p));
    if (matched.length === 0)
        return null;
    const label = matched
        .map((p) => `- ${p} declared more than once`)
        .join('\n');
    return {
        header: 'Duplicate declarations',
        label,
        ariaLabel: `Duplicate CSS declarations: ${matched.join(', ')}`,
    };
};
/**
 * Override-active state for a section title — fires when any of the
 * section's fields is overridden at the currently-active axis (a
 * non-desktop breakpoint OR a non-default state). Returns tooltip
 * data plus the right-click handler that resets the affected
 * overrides at that axis.
 *
 * Only one axis surfaces at a time — non-default states are disabled
 * at non-desktop breakpoints, so when both could apply we never
 * actually have both active.
 */
const useOverrideIndicator = (elementId, fields) => {
    const overriddenBreakpointFields = useBreakpointOverrideFields(elementId ?? '');
    const overriddenStateFields = useStateOverrideFields(elementId ?? '');
    const activeBreakpointId = useCanvasStore((s) => s.activeBreakpointId);
    const activeStateName = useCanvasStore((s) => s.activeStateName);
    const resetBreakpointFields = useCanvasStore((s) => s.resetElementFieldsAtBreakpoint);
    const resetStateFields = useCanvasStore((s) => s.resetElementFieldsAtState);
    if (!elementId || !fields || fields.length === 0)
        return null;
    // Pick which axis to surface. Prefer state when one is active —
    // breakpoint indicators are also disabled (state ⇒ desktop) by the
    // switcher's effect, so this branch ordering matches the routing.
    const axis = activeStateName !== null
        ? 'state'
        : activeBreakpointId !== 'desktop'
            ? 'breakpoint'
            : null;
    if (axis === null)
        return null;
    const overriddenFields = axis === 'state' ? overriddenStateFields : overriddenBreakpointFields;
    const overriddenInSection = fields.filter((f) => overriddenFields.has(f));
    if (overriddenInSection.length === 0)
        return null;
    const label = formatOverrideList(overriddenInSection);
    const handleContextMenu = (e) => {
        e.preventDefault();
        if (axis === 'state' && activeStateName !== null) {
            resetStateFields(elementId, activeStateName, overriddenInSection);
        }
        else if (axis === 'breakpoint') {
            resetBreakpointFields(elementId, activeBreakpointId, overriddenInSection);
        }
    };
    return {
        header: 'Style Overrides',
        label,
        ariaLabel: `Overridden styles: ${label}`,
        onContextMenu: handleContextMenu,
    };
};
/**
 * Format a list of BreakpointOverride field keys as the body of the
 * section-indicator tooltip. Field pairs that represent one CSS
 * property are deduped (e.g. widthMode + widthValue → "width") so
 * the list reads like CSS, not like internal state.
 *
 * The "Style Overrides" header + border separator is rendered by
 * `Tooltip` itself via its `header` prop; this function returns only
 * the bulleted body.
 */
const formatOverrideList = (fields) => {
    const seen = new Set();
    const labels = [];
    for (const field of fields) {
        const label = FIELD_LABELS[field] ?? String(field);
        if (seen.has(label))
            continue;
        seen.add(label);
        labels.push(label);
    }
    return labels.map((l) => `- ${l}`).join('\n');
};
/** Human-readable CSS names for each BreakpointOverride field. */
const FIELD_LABELS = {
    widthMode: 'width',
    widthValue: 'width',
    widthCustom: 'width',
    heightMode: 'height',
    heightValue: 'height',
    heightCustom: 'height',
    x: 'left',
    y: 'top',
    display: 'display',
    flexDirection: 'flex-direction',
    gap: 'gap',
    alignItems: 'align-items',
    justifyContent: 'justify-content',
    padding: 'padding',
    margin: 'margin',
    backgroundColor: 'background',
    borderRadius: 'border-radius',
    borderWidth: 'border-width',
    borderStyle: 'border-style',
    borderColor: 'border-color',
    opacity: 'opacity',
    visibilityMode: 'visibility',
    fontFamily: 'font-family',
    fontSize: 'font-size',
    fontWeight: 'font-weight',
    color: 'color',
    textAlign: 'text-align',
    lineHeight: 'line-height',
    letterSpacing: 'letter-spacing',
    boxShadows: 'box-shadow',
    mixBlendMode: 'mix-blend-mode',
    backgroundBlendMode: 'background-blend-mode',
    customProperties: 'custom CSS',
};
/** A labeled row inside a Section. Wraps the label and the control(s). */
export const Row = ({ label, children, tooltip }) => {
    const row = (_jsxs("div", { className: styles.row, children: [_jsx("span", { className: styles.rowLabel, children: label }), _jsx("div", { className: styles.rowControl, children: children })] }));
    // The row's label automatically becomes the tooltip header so
    // call sites only need to write the description text — no need
    // to repeat the label name in every tooltip string.
    return tooltip ? (_jsx(Tooltip, { header: label, label: tooltip, children: row })) : (row);
};
/**
 * Two label-on-top fields side by side. Used by sections that have
 * naturally-paired controls (Duration + Easing, Delay + Iteration,
 * Direction + Fill mode). Each field is wrapped in a Tooltip with its
 * own label as the header so hovering anywhere in that half surfaces
 * the right description.
 */
export const DualField = ({ left, right }) => {
    return (_jsxs("div", { className: styles.dualField, children: [_jsx(FieldHalf, { ...left }), _jsx(FieldHalf, { ...right })] }));
};
const FieldHalf = ({ label, tooltip, children }) => {
    const body = (_jsxs("div", { className: styles.fieldHalf, children: [_jsx("span", { className: styles.fieldLabel, children: label }), _jsx("div", { className: styles.fieldControl, children: children })] }));
    return tooltip ? (_jsx(Tooltip, { header: label, label: tooltip, children: body })) : (body);
};
