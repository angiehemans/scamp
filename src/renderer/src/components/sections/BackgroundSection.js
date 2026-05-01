import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore, selectProjectColors } from '@store/canvasSlice';
import { useResolvedElement } from '@store/useResolvedElement';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { ColorInput } from '../controls/ColorInput';
import { SegmentedControl } from '../controls/SegmentedControl';
import { Tooltip } from '../controls/Tooltip';
import { Section, Row } from './Section';
import styles from './BackgroundSection.module.css';
const BG_SIZE_OPTIONS = [
    { value: 'cover', label: 'Cover', tooltip: 'Fill the element, cropping the image if needed' },
    { value: 'contain', label: 'Contain', tooltip: 'Fit the whole image inside, leaving empty space if needed' },
    { value: 'auto', label: 'Auto', tooltip: 'Use the image at its original size' },
];
const BG_REPEAT_OPTIONS = [
    { value: 'no-repeat', label: 'None', tooltip: 'No repeat — show the image once' },
    { value: 'repeat', label: 'All', tooltip: 'Tile the image in both directions' },
    { value: 'repeat-x', label: 'X', tooltip: 'Tile the image horizontally' },
    { value: 'repeat-y', label: 'Y', tooltip: 'Tile the image vertically' },
];
const BG_POSITION_OPTIONS = [
    'top left', 'top center', 'top right',
    'center left', 'center', 'center right',
    'bottom left', 'bottom center', 'bottom right',
];
export const BackgroundSection = ({ elementId }) => {
    const element = useResolvedElement(elementId);
    const patchElement = useCanvasStore((s) => s.patchElement);
    const projectColors = useCanvasStore(selectProjectColors);
    const themeTokens = useCanvasStore((s) => s.themeTokens);
    const openThemePanel = useCanvasStore((s) => s.openThemePanel);
    const activePage = useCanvasStore((s) => s.activePage);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const projectPath = useCanvasStore((s) => s.projectPath);
    if (!element)
        return null;
    const bgImage = element.customProperties['background-image'] ?? null;
    const bgSize = element.customProperties['background-size'] ?? 'cover';
    const bgPosition = element.customProperties['background-position'] ?? 'center';
    const bgRepeat = element.customProperties['background-repeat'] ?? 'no-repeat';
    const handleSetBackgroundImage = async () => {
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
        patchElement(elementId, {
            customProperties: {
                ...element.customProperties,
                'background-image': `url("${copied.relativePath}")`,
                'background-size': 'cover',
                'background-position': 'center',
                'background-repeat': 'no-repeat',
            },
        });
    };
    const handleRemoveBackgroundImage = () => {
        const next = { ...element.customProperties };
        delete next['background-image'];
        delete next['background-size'];
        delete next['background-position'];
        delete next['background-repeat'];
        patchElement(elementId, { customProperties: next });
    };
    const updateBgProp = (prop, value) => {
        patchElement(elementId, {
            customProperties: {
                ...element.customProperties,
                [prop]: value,
            },
        });
    };
    return (_jsxs(Section, { title: "Background", elementId: elementId, fields: ['backgroundColor'], children: [_jsx(Row, { label: "", children: _jsx(ColorInput, { value: element.backgroundColor, onChange: (value) => patchElement(elementId, { backgroundColor: value }), presetColors: projectColors.length > 0 ? projectColors : undefined, tokens: themeTokens, onOpenTheme: openThemePanel ?? undefined }) }), _jsx(Row, { label: "", children: _jsx("button", { className: styles.imageButton, onClick: () => void handleSetBackgroundImage(), type: "button", children: bgImage ? 'Replace image' : 'Set background image' }) }), bgImage && (_jsxs(_Fragment, { children: [_jsx(Row, { label: "Size", children: _jsx(SegmentedControl, { value: bgSize, options: BG_SIZE_OPTIONS, onChange: (value) => updateBgProp('background-size', value) }) }), _jsx(Row, { label: "Position", children: _jsx("div", { className: styles.positionGrid, children: BG_POSITION_OPTIONS.map((opt) => (_jsx(Tooltip, { label: `Anchor the image to the ${opt}`, children: _jsx("button", { className: `${styles.positionBtn} ${bgPosition === opt ? styles.positionActive : ''}`, onClick: () => updateBgProp('background-position', opt), type: "button" }) }, opt))) }) }), _jsx(Row, { label: "Repeat", children: _jsx(SegmentedControl, { value: bgRepeat, options: BG_REPEAT_OPTIONS, onChange: (value) => updateBgProp('background-repeat', value) }) }), _jsx(Row, { label: "", children: _jsx("button", { className: styles.removeButton, onClick: handleRemoveBackgroundImage, type: "button", children: "Remove background image" }) })] }))] }));
};
