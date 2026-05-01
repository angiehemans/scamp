import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import styles from './ImageSection.module.css';
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
    const activePage = useCanvasStore((s) => s.activePage);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const projectPath = useCanvasStore((s) => s.projectPath);
    if (!element || element.type !== 'image')
        return null;
    const objFit = element.customProperties['object-fit'] ?? 'cover';
    const objPosition = element.customProperties['object-position'] ?? 'center';
    const handleReplace = async () => {
        if (!activePage || !projectPath)
            return;
        const chosen = await window.scamp.chooseImage({
            defaultPath: `${projectPath}/${assetsDirSegment(projectFormat)}`,
        });
        if (chosen.canceled || !chosen.path)
            return;
        const copied = await window.scamp.copyImage({
            sourcePath: chosen.path,
            projectPath,
        });
        patchElement(elementId, { src: copied.relativePath, alt: copied.fileName });
    };
    const updateCustomProp = (prop, value) => {
        patchElement(elementId, {
            customProperties: {
                ...element.customProperties,
                [prop]: value,
            },
        });
    };
    return (_jsxs(Section, { title: "Image", children: [_jsx(Row, { label: "Source", children: _jsxs("div", { className: styles.sourceRow, children: [element.src ? (_jsx(Tooltip, { label: element.src, children: _jsx("span", { className: styles.sourcePath, children: element.src.split('/').pop() ?? '(none)' }) })) : (_jsx("span", { className: styles.sourcePath, children: "(none)" })), _jsx("button", { className: styles.replaceBtn, onClick: () => void handleReplace(), type: "button", children: "Replace" })] }) }), _jsx(Row, { label: "Alt text", children: _jsx("input", { className: styles.altInput, type: "text", value: element.alt ?? '', onChange: (e) => patchElement(elementId, { alt: e.target.value }), placeholder: "Image description" }) }), _jsx(Row, { label: "Fit", children: _jsx(SegmentedControl, { value: objFit, options: OBJ_FIT_OPTIONS, onChange: (value) => updateCustomProp('object-fit', value) }) }), _jsx(Row, { label: "Position", children: _jsx("div", { className: styles.positionGrid, children: OBJ_POSITION_OPTIONS.map((opt) => (_jsx(Tooltip, { label: `Anchor the image to the ${opt}`, children: _jsx("button", { className: `${styles.positionBtn} ${objPosition === opt ? styles.positionActive : ''}`, onClick: () => updateCustomProp('object-position', opt), type: "button" }) }, opt))) }) })] }));
};
