import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';
import { PositionSection } from './sections/PositionSection';
import { SizeSection } from './sections/SizeSection';
import { LayoutSection } from './sections/LayoutSection';
import { SpacingSection } from './sections/SpacingSection';
import { BackgroundSection } from './sections/BackgroundSection';
import { BorderSection } from './sections/BorderSection';
import { ElementSection } from './sections/ElementSection';
import { TypographySection } from './sections/TypographySection';
import { ImageSection } from './sections/ImageSection';
import { VisibilitySection } from './sections/VisibilitySection';
import { TransitionsSection } from './sections/TransitionsSection';
import { AnimationSection } from './sections/AnimationSection';
import styles from './PropertiesPanel.module.css';
/**
 * The typed view of the properties panel. Reads the primary selected
 * element from the store and renders the sections that apply to its
 * element type. Root is treated like a regular rectangle — it just
 * has no parent, so Position is hidden.
 *
 * Each section is its own small component that reads its own slice of
 * the store and writes via `patchElement`. The UI panel is a thin
 * orchestrator with no edit logic of its own.
 */
export const UiPanel = () => {
    const elementId = useCanvasStore((s) => s.selectedElementIds[0] ?? null);
    const element = useCanvasStore((s) => (elementId ? s.elements[elementId] : undefined));
    const parentIsFlex = useCanvasStore((s) => {
        if (!element || !element.parentId)
            return false;
        const parent = s.elements[element.parentId];
        return parent?.display === 'flex';
    });
    if (!elementId || !element)
        return _jsx(_Fragment, {});
    const isRoot = elementId === ROOT_ELEMENT_ID;
    const isText = element.type === 'text';
    const isImage = element.type === 'image';
    const isInput = element.type === 'input';
    // Position is only meaningful when there's a non-flex parent to
    // anchor against. Root has no parent; flex children flow with the
    // layout engine.
    const showPosition = !isRoot && !parentIsFlex;
    return (_jsxs("div", { className: styles.uiPanelBody, children: [!isRoot && _jsx(ElementSection, { elementId: elementId }), showPosition && _jsx(PositionSection, { elementId: elementId }), _jsx(SizeSection, { elementId: elementId }), !isText && !isImage && !isInput && _jsx(LayoutSection, { elementId: elementId }), _jsx(SpacingSection, { elementId: elementId, hideMargin: isRoot }), !isImage && _jsx(BackgroundSection, { elementId: elementId }), !isImage && _jsx(BorderSection, { elementId: elementId }), isImage && _jsx(ImageSection, { elementId: elementId }), isText && _jsx(TypographySection, { elementId: elementId }), _jsx(VisibilitySection, { elementId: elementId }), _jsx(TransitionsSection, { elementId: elementId }), _jsx(AnimationSection, { elementId: elementId })] }));
};
