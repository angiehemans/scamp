// Pure DOM hit-testing for the canvas interaction layer. We rely on
// `document.elementsFromPoint` rather than maintaining a parallel quadtree
// — the canvas DOM is small and React's render is the source of truth.
import type { ResizeHandle } from './types';

/**
 * Read a node's `data-element-id`, for both HTML and SVG elements. An
 * inline `<svg>` on the canvas is an `SVGElement`, not an `HTMLElement`,
 * so an `instanceof HTMLElement` filter skips it and its shape children —
 * making the svg unhittable by `elementsFromPoint` (can't click-select it,
 * can't target it while dragging). Both element kinds carry `dataset`.
 */
export const elementIdOf = (node: Element): string | undefined =>
  node instanceof HTMLElement || node instanceof SVGElement
    ? node.dataset['elementId']
    : undefined;

/**
 * Hit-test the cursor against existing elements. Returns the deepest
 * `data-element-id` under the point.
 */
export const hitTest = (clientX: number, clientY: number): string | null => {
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const node of candidates) {
    const id = elementIdOf(node);
    if (id) return id;
  }
  return null;
};

/**
 * Look for a prop-text span under the cursor. Prop-text on a component
 * instance carries `data-scamp-instance-id` + `data-scamp-prop`
 * (set in ElementRenderer's `renderComponentSubtree`). We only surface
 * a hit if we see those before we walk through the instance's
 * `data-element-id` wrapper — otherwise a deeper match would jump out
 * of the instance we actually clicked.
 */
export const propTextHitTest = (
  clientX: number,
  clientY: number
): { instanceId: string; propName: string } | null => {
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    const instanceId = node.dataset['scampInstanceId'];
    const propName = node.dataset['scampProp'];
    if (instanceId && propName) return { instanceId, propName };
    if (node.dataset['elementId']) return null;
  }
  return null;
};

export const isResizeHandle = (
  clientX: number,
  clientY: number
): ResizeHandle | null => {
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const node of candidates) {
    if (node instanceof HTMLElement && node.dataset['handle']) {
      return node.dataset['handle'] as ResizeHandle;
    }
  }
  return null;
};
