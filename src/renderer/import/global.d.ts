import type { ScampImportApi } from '../../preload/import';

declare global {
  interface Window {
    scampImport: ScampImportApi;
  }
}

export {};
