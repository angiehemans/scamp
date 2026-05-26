export declare const COMPONENT_THUMBNAIL_UPDATED_EVENT = "scamp:component-thumbnail-updated";
export type ComponentThumbnailUpdatedDetail = {
    componentName: string;
};
export type CaptureThumbnailInputs = {
    projectPath: string;
    componentName: string;
};
/** Fire-and-forget; never blocks the underlying save. */
export declare const captureAndPersistComponentThumbnail: (inputs: CaptureThumbnailInputs) => void;
