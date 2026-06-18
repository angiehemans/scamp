import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCanvasStore } from '@store/canvasSlice';
import { useColorPickerContext } from '@store/hooks/useColorPickerContext';
import { useGroupToggle, useResolvedElement } from '@store/useResolvedElement';
import { assetsDirSegment } from '@renderer/src/lib/path';
import { BlendModeSelect } from '../controls/BlendModeSelect';
import { Button } from '../controls/Button';
import { ColorInput } from '../controls/ColorInput';
import { previewStyle } from '../controls/livePreview';
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
    const patchCustomProperties = useCanvasStore((s) => s.patchCustomProperties);
    const { presetColors, themeTokens, onOpenTheme } = useColorPickerContext();
    const activePage = useCanvasStore((s) => s.activePage);
    const projectFormat = useCanvasStore((s) => s.projectFormat);
    const projectPath = useCanvasStore((s) => s.projectPath);
    // Hide the group-toggle eye when there's nothing in this section
    // to hide. Stays visible while the group is already off so the
    // user can flip it back on without first re-adding a value.
    const hasBackgroundContent = element !== undefined &&
        (element.backgroundColor !== 'transparent' ||
            (element.customProperties['background-image'] ?? null) !== null);
    const groupToggle = useGroupToggle(elementId, 'background', hasBackgroundContent);
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
        patchCustomProperties(elementId, {
            'background-image': `url("${copied.relativePath}")`,
            'background-size': 'cover',
            'background-position': 'center',
            'background-repeat': 'no-repeat',
        });
    };
    const handleRemoveBackgroundImage = () => {
        patchCustomProperties(elementId, {
            'background-image': undefined,
            'background-size': undefined,
            'background-position': undefined,
            'background-repeat': undefined,
        });
    };
    const updateBgProp = (prop, value) => {
        patchCustomProperties(elementId, { [prop]: value });
    };
    // Only surface the background-blend dropdown when a blend can
    // actually be observed: an image AND a non-default color.
    const showBackgroundBlend = bgImage !== null && element.backgroundColor !== 'transparent';
    return (_jsxs(Section, { title: "Background", elementId: elementId, groupToggle: groupToggle, fields: ['backgroundColor', 'backgroundBlendMode'], cssProperties: [
            'background',
            'background-color',
            'background-image',
            'background-size',
            'background-position',
            'background-repeat',
            'background-blend-mode',
        ], children: [_jsx(Row, { label: "", children: _jsx(ColorInput, { value: element.backgroundColor, onChange: (value) => patchElement(elementId, { backgroundColor: value }), onPreview: previewStyle(elementId, 'backgroundColor'), historyElementId: elementId, historyPropertyKey: "backgroundColor", presetColors: presetColors, tokens: themeTokens, onOpenTheme: onOpenTheme }) }), _jsx(Row, { label: "", children: _jsx(Button, { variant: "secondary", size: "sm", fullWidth: true, onClick: () => void handleSetBackgroundImage(), children: bgImage ? 'Replace image' : 'Set background image' }) }), bgImage && (_jsxs(_Fragment, { children: [_jsx(Row, { label: "Size", children: _jsx(SegmentedControl, { value: bgSize, options: BG_SIZE_OPTIONS, onChange: (value) => updateBgProp('background-size', value) }) }), _jsx(Row, { label: "Position", children: _jsx("div", { className: styles.positionGrid, children: BG_POSITION_OPTIONS.map((opt) => (_jsx(Tooltip, { label: `Anchor the image to the ${opt}`, children: _jsx("button", { className: `${styles.positionBtn} ${bgPosition === opt ? styles.positionActive : ''}`, onClick: () => updateBgProp('background-position', opt), type: "button" }) }, opt))) }) }), _jsx(Row, { label: "Repeat", children: _jsx(SegmentedControl, { value: bgRepeat, options: BG_REPEAT_OPTIONS, onChange: (value) => updateBgProp('background-repeat', value) }) }), showBackgroundBlend && (_jsx(Row, { label: "Blend", children: _jsx(BlendModeSelect, { value: element.backgroundBlendMode, onChange: (value) => patchElement(elementId, { backgroundBlendMode: value }), title: "How the background image blends with the background color" }) })), _jsx(Row, { label: "", children: _jsx(Button, { variant: "dangerGhost", size: "sm", fullWidth: true, onClick: handleRemoveBackgroundImage, children: "Remove background image" }) })] }))] }));
};
