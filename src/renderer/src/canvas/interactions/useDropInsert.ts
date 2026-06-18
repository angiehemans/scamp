import { type DragEvent } from 'react';

import { useCanvasStore } from '@store/canvasSlice';
import { ROOT_ELEMENT_ID } from '@lib/element';

import { hitTest } from './canvasHitTest';
import { DEFAULT_IMAGE_SIZE } from './constants';
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
export const useDropInsert = (geometry: CanvasGeometry): DropInsert => {
  const activePage = useCanvasStore((s) => s.activePage);
  const projectPath = useCanvasStore((s) => s.projectPath);
  const createImage = useCanvasStore((s) => s.createImage);

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    // Accept image files from the OS file manager.
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    if (!activePage) return;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    const file = files[0]!;
    // Only accept image types.
    if (!file.type.startsWith('image/')) return;
    // Electron gives us the file path on the `path` property.
    const filePath = (file as File & { path?: string }).path;
    if (!filePath) return;

    if (!projectPath) return;
    const hitId = hitTest(e.clientX, e.clientY) ?? ROOT_ELEMENT_ID;
    const parentRect =
      geometry.measureElementInFrame(hitId) ?? { x: 0, y: 0, w: 0, h: 0 };
    const { x, y } = geometry.toFrame(e.clientX, e.clientY);
    const parent = geometry.parentSizeOf(hitId);

    void (async (): Promise<void> => {
      const copied = await window.scamp.copyImage({
        sourcePath: filePath,
        projectPath,
      });
      const localX = x - parentRect.x;
      const localY = y - parentRect.y;
      const clampedX = Math.max(0, Math.min(localX, parent.w - DEFAULT_IMAGE_SIZE));
      const clampedY = Math.max(0, Math.min(localY, parent.h - DEFAULT_IMAGE_SIZE));
      createImage({
        parentId: hitId,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        width: DEFAULT_IMAGE_SIZE,
        height: DEFAULT_IMAGE_SIZE,
        src: copied.relativePath,
        alt: copied.fileName,
      });
    })();
  };

  return { handleDragOver, handleDrop };
};
