import type { ImportOpenArgs } from '@shared/types';
export declare const openImportWindow: (args: ImportOpenArgs) => Promise<{
    id: number;
}>;
export declare const closeImportWindow: (projectPath: string) => void;
export declare const registerImportIpc: () => void;
