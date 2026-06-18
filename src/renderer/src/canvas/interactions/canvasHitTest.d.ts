import type { ResizeHandle } from './types';
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
