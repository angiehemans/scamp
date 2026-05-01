import type { AnimationPresetName, ElementAnimation } from './element';
export type AnimationPresetCategory = 'entrance' | 'exit' | 'attention' | 'subtle';
/**
 * Defaults the picker writes when the user selects this preset. The
 * library decides what "sensible" means per-animation (e.g. `pulse`
 * defaults to `infinite`, entrance animations default to `forwards`
 * so the end state holds).
 */
export type AnimationPresetDefaults = Pick<ElementAnimation, 'durationMs' | 'easing' | 'iterationCount' | 'direction' | 'fillMode'>;
export type AnimationPreset = {
    name: AnimationPresetName;
    category: AnimationPresetCategory;
    description: string;
    defaults: AnimationPresetDefaults;
    /**
     * Canonical keyframes body (the part between the outer braces of
     * `@keyframes <name> { ... }`). Used for both initial emission
     * and structural-equivalence comparison on parse.
     */
    body: string;
};
export declare const ANIMATION_PRESETS: ReadonlyArray<AnimationPreset>;
export declare const PRESETS_BY_NAME: ReadonlyMap<AnimationPresetName, AnimationPreset>;
/** True when `name` matches a preset in the library. */
export declare const isPresetName: (name: string) => name is AnimationPresetName;
