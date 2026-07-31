import { type DragEvent } from 'react';
import type { CanvasGeometry, ReparentDrop } from './types';
/** Mime carrying the component name on a sidebar drag. */
export declare const COMPONENT_DRAG_MIME = "application/x-scamp-component";
export type ComponentDrop = {
    handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
    handleDragLeave: (e: DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: DragEvent<HTMLDivElement>) => void;
    /** The pending target while a component is dragged over the canvas. */
    drop: ReparentDrop | null;
};
/**
 * Drops a component from the sidebar into whatever container is under the
 * cursor, rather than always at the page root. Mirrors the canvas
 * reparent drag: a flex/grid target shows a gap line and inserts at that
 * index; anything else outlines the container and places the instance at
 * the cursor. see docs/plans/canvas-drag-reparent-plan.md
 */
export declare const useComponentDrop: (geometry: CanvasGeometry) => ComponentDrop;
