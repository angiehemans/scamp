import { type DragEvent } from 'react';
import type { CanvasGeometry } from './types';
export type DropInsert = {
    handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: DragEvent<HTMLDivElement>) => void;
};
/**
 * Accepts image files dropped onto the canvas from the OS file manager:
 * copies the file into the project's assets dir and creates an image
 * element at the drop point, clamped to the parent bounds.
 */
export declare const useDropInsert: (geometry: CanvasGeometry) => DropInsert;
