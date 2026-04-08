import type { ScampApi } from '../preload/index';

declare global {
  interface Window {
    scamp: ScampApi;
  }
}

export {};
