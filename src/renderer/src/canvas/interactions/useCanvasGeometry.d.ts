import { type RefObject } from 'react';
import type { CanvasGeometry } from './types';
/**
 * Builds the frame-local geometry helpers the interaction hooks share:
 * coordinate conversion, DOM measurement, and the parent-bounds lookups
 * used to clamp draw / move / resize. Bound to the current frame element,
 * render scale, and element tree.
 *
 * The frame is rendered via `transform: scale`, which has well-defined,
 * platform-consistent behavior: `getBoundingClientRect()` returns the
 * visible (scaled) rect while `offsetWidth/Left` stay in logical pixels.
 */
export declare const useCanvasGeometry: (frameRef: RefObject<HTMLDivElement>, scale: number) => CanvasGeometry;
