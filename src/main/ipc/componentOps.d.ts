import type { ComponentCreateArgs, ComponentDeleteArgs, ComponentFile, ComponentReadArgs, ComponentReadThumbnailArgs, ComponentReadThumbnailResult, ComponentWriteThumbnailArgs, ComponentWriteThumbnailResult, ProjectFormat } from '@shared/types';
/**
 * Path layout for one component. Mirrors `pagePathsFor` in
 * shape — folder + TSX + CSS module, where the folder is the
 * component's canonical identifier.
 */
export declare const componentPathsFor: (projectPath: string, componentName: string) => {
    tsxPath: string;
    cssPath: string;
    componentDir: string;
};
export declare const createComponent: (args: ComponentCreateArgs, format: ProjectFormat) => Promise<ComponentFile>;
export declare const deleteComponent: (args: ComponentDeleteArgs, format: ProjectFormat) => Promise<void>;
export declare const readComponent: (args: ComponentReadArgs, format: ProjectFormat) => Promise<ComponentFile | null>;
export declare const writeComponentThumbnail: (args: ComponentWriteThumbnailArgs, format: ProjectFormat) => Promise<ComponentWriteThumbnailResult>;
export declare const readComponentThumbnail: (args: ComponentReadThumbnailArgs, format: ProjectFormat) => Promise<ComponentReadThumbnailResult>;
