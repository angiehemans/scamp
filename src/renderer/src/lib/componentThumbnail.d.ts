/**
 * Dispatched after a thumbnail successfully writes to disk so the
 * sidebar can refresh its cached `<img>` source. We use a custom
 * event rather than relying on chokidar because the watcher
 * intentionally ignores dotfile-prefixed paths (`.scamp/` is one
 * of them) so it doesn't thrash on tooling artefacts.
 */
export declare const COMPONENT_THUMBNAIL_UPDATED_EVENT = "scamp:component-thumbnail-updated";
export type ComponentThumbnailUpdatedDetail = {
    componentName: string;
};
export type CaptureThumbnailInputs = {
    projectPath: string;
    componentName: string;
};
/**
 * Fire-and-forget capture. Awaits internally but the outer
 * caller doesn't need to — the save pipeline shouldn't depend
 * on thumbnail capture succeeding.
 */
export declare const captureAndPersistComponentThumbnail: (inputs: CaptureThumbnailInputs) => void;
