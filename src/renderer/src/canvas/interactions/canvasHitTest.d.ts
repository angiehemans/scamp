import type { ResizeHandle } from './types';
/**
 * Read a node's `data-element-id`, for both HTML and SVG elements. An
 * inline `<svg>` on the canvas is an `SVGElement`, not an `HTMLElement`,
 * so an `instanceof HTMLElement` filter skips it and its shape children —
 * making the svg unhittable by `elementsFromPoint` (can't click-select it,
 * can't target it while dragging). Both element kinds carry `dataset`.
 */
export declare const elementIdOf: (node: Element) => string | undefined;
/**
 * Hit-test the cursor against existing elements. Returns the deepest
 * `data-element-id` under the point.
 */
export declare const hitTest: (clientX: number, clientY: number) => string | null;
/**
 * Look for a prop-text span under the cursor. Prop-text on a component
 * instance carries `data-scamp-instance-id` + `data-scamp-prop`
 * (set in ElementRenderer's `renderComponentSubtree`). We only surface
 * a hit if we see those before we walk through the instance's
 * `data-element-id` wrapper — otherwise a deeper match would jump out
 * of the instance we actually clicked.
 */
export declare const propTextHitTest: (clientX: number, clientY: number) => {
    instanceId: string;
    propName: string;
} | null;
export declare const isResizeHandle: (clientX: number, clientY: number) => ResizeHandle | null;
