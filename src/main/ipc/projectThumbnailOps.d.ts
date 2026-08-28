import type { ProjectReadThumbnailArgs, ProjectReadThumbnailResult, ProjectWriteThumbnailArgs, ProjectWriteThumbnailResult } from '@shared/types';
export declare const thumbnailPathFor: (projectPath: string) => string;
/**
 * Refuse anything implausible for a 640px-wide PNG.
 *
 * The renderer crops before sending, so a payload this size means
 * something upstream is wrong — a full-resolution capture of a very long
 * page, most likely. Writing it would put megabytes into the user's
 * project folder on every save, silently.
 */
export declare const MAX_THUMBNAIL_BYTES: number;
export declare const writeProjectThumbnail: (args: ProjectWriteThumbnailArgs) => Promise<ProjectWriteThumbnailResult>;
export declare const readProjectThumbnail: (args: ProjectReadThumbnailArgs) => Promise<ProjectReadThumbnailResult>;
/** For the projects list, which only needs to know whether to expect one. */
export declare const hasProjectThumbnail: (projectPath: string) => Promise<boolean>;
