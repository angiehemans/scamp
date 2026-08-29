import { useEffect, useState } from 'react';

import { containerOverflow, formatOverflowLabel } from '@lib/canvasOverflow';

import { layoutEdges } from './animatedExtent';
import styles from './NestedOverflowMarkers.module.css';

/**
 * Marks nested containers whose children no longer fit.
 *
 * The page root already has `CanvasBoundaryOverlay`. Nothing flagged an
 * over-full container INSIDE the page — a flex row whose children spill
 * renders that spill visibly (deliberate: Scamp does not auto-clip, which
 * would hide content in generated code), but silently. That became easy
 * to produce once drawing stopped clamping to the parent.
 *
 * Three things this must not do, each learned the hard way:
 *
 * - **Never consult `scrollWidth`.** A container with `overflow: visible`
 *   reports `scrollWidth === clientWidth`, so the spill is invisible to
 *   it. Measured from child geometry instead.
 * - **Never measure a transform.** An element mid-animation has a
 *   bounding box that moves, which would flash markers on and off
 *   through the animation — the same mechanism that once flipped the
 *   artboard zoom on every edit. `layoutEdges` reads `offsetLeft` /
 *   `offsetWidth`, which transforms do not touch.
 *   see docs/notes/canvas-extent-oscillation.md
 * - **Never render into an export.** Everything here carries
 *   `data-canvas-chrome`, which the capture filter strips.
 *
 * Cost is linear in element count: each element is visited once, as a
 * child of its own parent.
 */

type Marker = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
};

type Props = {
  /** Frame element to scan. Markers are positioned in its logical space. */
  frame: HTMLElement | null;
  /** Applied canvas zoom. Only used to counter-scale the label — marker
   *  boxes are in frame-local px and the frame's transform scales them. */
  scale: number;
  /** Any value that changes when the tree does, to trigger a re-scan. */
  revision: unknown;
};

const scan = (frame: HTMLElement): Marker[] => {
  const markers: Marker[] = [];
  for (const node of frame.querySelectorAll('[data-element-id]')) {
    if (!(node instanceof HTMLElement)) continue;
    // Only containers that lay their children out can meaningfully
    // overflow in a way the user can act on.
    const display = globalThis.getComputedStyle(node).display;
    if (display !== 'flex' && display !== 'grid') continue;
    if (node.children.length === 0) continue;

    const children: Array<{ right: number; bottom: number }> = [];
    for (const child of node.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.getAttribute('data-canvas-chrome') === 'true') continue;
      const edges = layoutEdges(child, node);
      if (edges !== null) children.push(edges);
    }
    const over = containerOverflow(children, node.clientWidth, node.clientHeight);
    if (over.x === 0 && over.y === 0) continue;

    const box = layoutEdges(node, frame);
    if (box === null) continue;
    markers.push({
      id: node.getAttribute('data-element-id') ?? '',
      left: box.right - node.offsetWidth,
      top: box.bottom - node.offsetHeight,
      width: node.offsetWidth,
      height: node.offsetHeight,
      label: formatOverflowLabel(Math.max(over.x, over.y)),
    });
  }
  return markers;
};

export const NestedOverflowMarkers = ({
  frame,
  scale,
  revision,
}: Props): JSX.Element | null => {
  const [markers, setMarkers] = useState<ReadonlyArray<Marker>>([]);

  useEffect(() => {
    if (!frame) {
      setMarkers([]);
      return;
    }
    // After paint, so the scan sees the layout this render produced.
    const id = requestAnimationFrame(() => setMarkers(scan(frame)));
    return () => cancelAnimationFrame(id);
  }, [frame, revision]);

  if (markers.length === 0) return null;
  return (
    <div
      className={styles.layer}
      style={{ pointerEvents: 'none' }}
      data-canvas-chrome="true"
      aria-hidden="true"
    >
      {markers.map((marker) => (
        <div
          key={marker.id}
          className={styles.marker}
          data-testid="nested-overflow-marker"
          data-element-overflow={marker.id}
          style={{
            left: marker.left,
            top: marker.top,
            width: marker.width,
            height: marker.height,
          }}
        >
          {/* Counter-scaled: the frame's transform would otherwise shrink
              the text to nothing at a fit-to-width zoom. */}
          <span
            className={styles.label}
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'bottom right' }}
          >
            {marker.label}
          </span>
        </div>
      ))}
    </div>
  );
};
