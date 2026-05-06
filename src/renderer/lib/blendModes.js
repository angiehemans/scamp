/**
 * Single source of truth for the blend-mode keyword set.
 *
 * The cssPropertyMap mappers and the panel `BlendModeSelect` both
 * derive their list from this module so a value added here is
 * automatically recognised by the parser AND surfaced in the UI.
 */
export const BLEND_MODE_VALUES = new Set([
    'normal',
    'multiply',
    'darken',
    'color-burn',
    'screen',
    'lighten',
    'color-dodge',
    'overlay',
    'soft-light',
    'hard-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
]);
/** Type-guard for the parser. */
export const isBlendMode = (v) => BLEND_MODE_VALUES.has(v);
export const BLEND_MODE_GROUPS = [
    {
        name: 'Darken',
        options: [
            { value: 'multiply', label: 'Multiply' },
            { value: 'darken', label: 'Darken' },
            { value: 'color-burn', label: 'Color burn' },
        ],
    },
    {
        name: 'Lighten',
        options: [
            { value: 'screen', label: 'Screen' },
            { value: 'lighten', label: 'Lighten' },
            { value: 'color-dodge', label: 'Color dodge' },
        ],
    },
    {
        name: 'Contrast',
        options: [
            { value: 'overlay', label: 'Overlay' },
            { value: 'soft-light', label: 'Soft light' },
            { value: 'hard-light', label: 'Hard light' },
        ],
    },
    {
        name: 'Inversion',
        options: [
            { value: 'difference', label: 'Difference' },
            { value: 'exclusion', label: 'Exclusion' },
        ],
    },
    {
        name: 'Component',
        options: [
            { value: 'hue', label: 'Hue' },
            { value: 'saturation', label: 'Saturation' },
            { value: 'color', label: 'Color' },
            { value: 'luminosity', label: 'Luminosity' },
        ],
    },
];
