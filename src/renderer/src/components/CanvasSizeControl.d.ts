import type { ProjectConfig } from '@shared/types';
type Props = {
    config: ProjectConfig;
    onChange: (next: ProjectConfig) => void;
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
export declare const CanvasSizeControl: ({ config, onChange }: Props) => JSX.Element;
export {};
