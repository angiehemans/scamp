import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { Button } from '../controls/Button';
import { PrefixSuffixInput } from '../controls/PrefixSuffixInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import styles from './ImageSection.module.css';
import { importImage } from '@renderer/src/lib/importImage';
const OBJ_FIT_OPTIONS = [
    { value: 'cover', label: 'Cover', tooltip: 'Fill the element, cropping the image if needed' },
    { value: 'contain', label: 'Contain', tooltip: 'Fit the whole image inside, leaving empty space if needed' },
    { value: 'fill', label: 'Fill', tooltip: 'Stretch the image to match the element, ignoring aspect ratio' },
    { value: 'none', label: 'None', tooltip: 'Use the image at its natural size' },
];
const OBJ_POSITION_OPTIONS = [
    'top left', 'top center', 'top right',
    'center left', 'center', 'center right',
    'bottom left', 'bottom center', 'bottom right',
];
export const ImageSection = ({ elementId }) => {
    const element = useCanvasStore((s) => s.elements[elementId]);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const patchCustomProperties = useCanvasStore((s) => s.patchCustomProperties);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const projectPath = useCanvasStore((s) => s.projectPath);
    if (!element || element.type !== 'image')
        return null;
    // A bound src/alt has no literal to edit: the value comes from a prop
    // or, inside a repeat, from the row. Show the expression so the field
    // explains itself rather than reading as empty.
    // see docs/notes/view-bindings.md
    const srcBinding = element.bind?.['src'];
    const altBinding = element.bind?.['alt'];
    const objFit = element.customProperties['object-fit'] ?? 'cover';
    const objPosition = element.customProperties['object-position'] ?? 'center';
    const handleReplace = async () => {
        // Deliberately NOT gated on `activePage`: a view is a component
        // with a page-sized canvas, so it sets `activeComponent` and leaves
        // `activePage` null. Guarding on it disabled Replace on every view
        // in a scamp project — which is every page — and in the component
        // editor everywhere. Nothing below reads it.
        if (!projectPath)
            return;
        const chosen = await window.scamp.chooseImage({
            defaultPath: `${projectPath}/${assetsDirSegment(projectFormat)}`,
        });
        if (chosen.canceled || !chosen.path)
            return;
        const copied = await importImage(chosen.path, projectPath);
        if (copied === null)
            return;
        patchElement(elementId, { src: copied.relativePath, alt: copied.fileName });
    };
    const updateCustomProp = (prop, value) => {
        patchCustomProperties(elementId, { [prop]: value });
    };
    return (_jsxs(Section, { title: "Image", children: [_jsx(Row, { label: "Source", children: _jsxs("div", { className: styles.sourceRow, children: [_jsx(PrefixSuffixInput, { value: srcBinding ?? element.src ?? '', onCommit: (next) => patchElement(elementId, { src: next }), placeholder: "Path or URL", disabled: srcBinding !== undefined, title: srcBinding === undefined
                                ? 'Source — a project path (/assets/photo.png) or an absolute URL. Use Replace to import a file instead.'
                                : `Source comes from data: ${srcBinding}. Change the binding in the Data tab.`, stopKeyPropagation: true }), _jsx(Button, { variant: "secondary", size: "sm", disabled: srcBinding !== undefined, onClick: () => void handleReplace(), children: "Replace" })] }) }), _jsx(Row, { label: "Alt text", children: _jsx("input", { className: styles.altInput, type: "text", value: altBinding ?? element.alt ?? '', onChange: (e) => patchElement(elementId, { alt: e.target.value }), placeholder: "Image description", disabled: altBinding !== undefined, title: altBinding === undefined
                        ? undefined
                        : `Alt text comes from data: ${altBinding}. Change the binding in the Data tab.` }) }), _jsx(Row, { label: "Fit", children: _jsx(SegmentedControl, { value: objFit, options: OBJ_FIT_OPTIONS, onChange: (value) => updateCustomProp('object-fit', value) }) }), _jsx(Row, { label: "Position", children: _jsx("div", { className: styles.positionGrid, children: OBJ_POSITION_OPTIONS.map((opt) => (_jsx(Tooltip, { label: `Anchor the image to the ${opt}`, children: _jsx("button", { className: `${styles.positionBtn} ${objPosition === opt ? styles.positionActive : ''}`, onClick: () => updateCustomProp('object-position', opt), type: "button" }) }, opt))) }) })] }));
};
