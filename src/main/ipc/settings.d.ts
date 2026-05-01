import type { Settings } from '@shared/types';
declare const getSettings: () => Promise<Settings>;
export declare const registerSettingsIpc: () => void;
export { getSettings };
