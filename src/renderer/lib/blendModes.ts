import type { BlendMode } from './element';

/**
 * Single source of truth for the blend-mode keyword set.
 *
 * The cssPropertyMap mappers and the panel `BlendModeSelect` both
 * derive their list from this module so a value added here is
 * automatically recognised by the parser AND surfaced in the UI.
 */
export const BLEND_MODE_VALUES: ReadonlySet<BlendMode> = new Set<BlendMode>([
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
export const isBlendMode = (v: string): v is BlendMode =>
  (BLEND_MODE_VALUES as ReadonlySet<string>).has(v);

/**
 * Ordered groups for the dropdown UI. The grouping mirrors how the
 * CSS spec organises blend modes and matches the story spec:
 *   Normal | Darken | Lighten | Contrast | Inversion | Component
 *
 * `'normal'` lives outside the groups as a top-level option in the
 * `<select>`. Order within each group matches the spec / story.
 */
export type BlendModeGroupName =
  | 'Darken'
  | 'Lighten'
  | 'Contrast'
  | 'Inversion'
  | 'Component';

export type BlendModeOption = {
  value: BlendMode;
  label: string;
};

export type BlendModeGroup = {
  name: BlendModeGroupName;
  options: ReadonlyArray<BlendModeOption>;
};

export const BLEND_MODE_GROUPS: ReadonlyArray<BlendModeGroup> = [
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
