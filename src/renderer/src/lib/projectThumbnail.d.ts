/**
 * Start-screen thumbnail capture. The component-sidebar equivalent one
 * level down is `componentThumbnail.ts`; this differs in two ways.
 *
 * It crops. A component is small and square-ish, so its capture goes to
 * disk as-is. A page is 1200 by several thousand, and a card is a wide
 * rectangle — see `@lib/thumbnailCrop` for what that means.
 *
 * And it only fires for the home page. The card's job is recognition: a
 * project should look like itself on the start screen, not like whichever
 * page you happened to stop on.
 *
 * see docs/notes/project-thumbnails.md
 */
/** The page whose capture represents the whole project. */
export declare const THUMBNAIL_PAGE_NAME = "home";
export type CaptureProjectThumbnailInputs = {
    projectPath: string;
    /** The page that was just saved. Anything but home is ignored. */
    pageName: string;
};
/** Fire-and-forget; never blocks the underlying save. */
export declare const captureAndPersistProjectThumbnail: (inputs: CaptureProjectThumbnailInputs) => void;
