import type { ProjectConfig } from '@shared/types';
type Props = {
    config: ProjectConfig;
    onChange: (next: ProjectConfig) => void;
    /**
     * When set, the control edits the canvas size for the named
     * component (writing to `config.componentCanvas[name]`) rather
     * than the project-wide page canvas. Switches the popover into
     * component-mode: width + height numeric inputs, no breakpoint
     * presets (breakpoints don't apply to component editing in
     * Phase 3.5 — only pages have responsive cascades).
     */
    componentName?: string;
};
/**
 * Toolbar control for the canvas viewport size + active breakpoint.
 *
 * The button's label reflects the active breakpoint (or a custom-
 * width readout when no preset matches). Clicking opens a popover
 * with:
 *   - A segmented list of the project's breakpoints. Clicking one
 *     sets canvas width AND active breakpoint — so subsequent
 *     property-panel edits land inside that breakpoint's @media
 *     block.
 *   - A custom-width input. Typing a value that doesn't match any
 *     breakpoint drops the active breakpoint to `desktop` so edits
 *     apply to the base CSS.
 *   - An overflow-hidden toggle (a viewport-frame preview helper,
 *     never written to CSS).
 */
export declare const CanvasSizeControl: ({ config, onChange, componentName, }: Props) => JSX.Element;
export {};
