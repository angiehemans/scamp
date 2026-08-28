/**
 * Read/write the start-screen project thumbnail.
 *
 * Unlike the component equivalent these are not gated on project format
 * or on the active project: the start screen reads thumbnails for projects
 * that are not open, which is the whole point of them.
 *
 * see docs/notes/project-thumbnails.md
 */
export declare const registerProjectThumbnailIpc: () => void;
