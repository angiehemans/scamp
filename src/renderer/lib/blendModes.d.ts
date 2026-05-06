import type { BlendMode } from './element';
/**
 * Single source of truth for the blend-mode keyword set.
 *
 * The cssPropertyMap mappers and the panel `BlendModeSelect` both
 * derive their list from this module so a value added here is
 * automatically recognised by the parser AND surfaced in the UI.
 */
export declare const BLEND_MODE_VALUES: ReadonlySet<BlendMode>;
/** Type-guard for the parser. */
export declare const isBlendMode: (v: string) => v is BlendMode;
/**
 * Ordered groups for the dropdown UI. The grouping mirrors how the
 * CSS spec organises blend modes and matches the story spec:
 *   Normal | Darken | Lighten | Contrast | Inversion | Component
 *
 * `'normal'` lives outside the groups as a top-level option in the
 * `<select>`. Order within each group matches the spec / story.
 */
export type BlendModeGroupName = 'Darken' | 'Lighten' | 'Contrast' | 'Inversion' | 'Component';
export type BlendModeOption = {
    value: BlendMode;
    label: string;
};
export type BlendModeGroup = {
    name: BlendModeGroupName;
    options: ReadonlyArray<BlendModeOption>;
};
export declare const BLEND_MODE_GROUPS: ReadonlyArray<BlendModeGroup>;
