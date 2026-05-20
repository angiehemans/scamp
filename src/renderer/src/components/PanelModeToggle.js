import { jsx as _jsx } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './PropertiesPanel.module.css';
const PAGE_OPTIONS = [
    { value: 'ui', label: 'Visual' },
    { value: 'css', label: 'CSS' },
];
// Component editor surfaces a third tab — see `PanelMode` for why.
const COMPONENT_OPTIONS = [
    { value: 'ui', label: 'Visual' },
    { value: 'css', label: 'CSS' },
    { value: 'data', label: 'Data' },
];
/**
 * Top-of-panel toggle between the typed UI view and the raw CSS editor.
 * The selection lives in the canvas store as `panelMode` so it survives
 * selection changes and re-renders without being persisted to disk.
 *
 * The Data tab is conditional:
 *   - Component editor → always shown (the user defines props there).
 *   - Page editor with a component-instance selected → shown when the
 *     instance's component declares at least one prop (Phase 6).
 *   - Page editor with anything else selected → hidden.
 */
export const PanelModeToggle = () => {
    const panelMode = useCanvasStore((s) => s.panelMode);
    const setPanelMode = useCanvasStore((s) => s.setPanelMode);
    const isComponentEditing = useCanvasStore((s) => s.activeComponent !== null);
    // Instance-side: the data tab shows up when the selected element is
    // a component-instance whose definition contains a text-prop. We
    // detect this by walking the component's element tree from the
    // store's `componentTrees` cache.
    const hasInstancePropToShow = useCanvasStore((s) => {
        if (s.activeComponent !== null)
            return false; // editor case handled above
        const selectedId = s.selectedElementIds[0];
        if (!selectedId)
            return false;
        const el = s.elements[selectedId];
        if (!el || el.type !== 'component-instance')
            return false;
        const name = el.componentName;
        if (!name)
            return false;
        const tree = s.componentTrees[name];
        if (!tree)
            return false;
        for (const child of Object.values(tree.elements)) {
            if (child.type === 'text' && typeof child.prop === 'string' && child.prop.length > 0) {
                return true;
            }
        }
        return false;
    });
    const showData = isComponentEditing || hasInstancePropToShow;
    const options = showData ? COMPONENT_OPTIONS : PAGE_OPTIONS;
    return (_jsx("div", { className: styles.modeToggleWrap, children: _jsx(SegmentedControl, { value: panelMode, options: options, onChange: setPanelMode }) }));
};
