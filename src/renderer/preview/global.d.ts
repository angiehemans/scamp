import type { ScampPreviewApi } from '../../preload/preview';

declare global {
  interface Window {
    scampPreview: ScampPreviewApi;
  }
}

export {};
