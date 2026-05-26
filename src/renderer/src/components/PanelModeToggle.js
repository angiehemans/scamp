import { jsx as _jsx } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { SegmentedControl } from './controls/SegmentedControl';
import styles from './PropertiesPanel.module.css';
const PAGE_OPTIONS = [
    { value: 'ui', label: 'Visual' },
    { value: 'css', label: 'CSS' },
];
const COMPONENT_OPTIONS = [
    { value: 'ui', label: 'Visual' },
    { value: 'css', label: 'CSS' },
    { value: 'data', label: 'Data' },
];
/** Panel tabs. Data tab visible in component editor OR for prop-instance on page. */
export const PanelModeToggle = () => {
    const panelMode = useCanvasStore((s) => s.panelMode);
    const setPanelMode = useCanvasStore((s) => s.setPanelMode);
    const isComponentEditing = useCanvasStore((s) => s.activeComponent !== null);
    const hasInstancePropToShow = useCanvasStore((s) => {
        if (s.activeComponent !== null)
            return false;
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
