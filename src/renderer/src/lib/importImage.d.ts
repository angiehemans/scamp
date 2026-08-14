import type { CopyImageResult } from '@shared/types';
/**
 * Import an image into the project, flagging the canvas as busy while it
 * converts.
 *
 * Every import path goes through here — the image tool, drag-and-drop,
 * Replace image, Set background image — so the indicator can't be wired
 * up in three places and forgotten in the fourth.
 * see docs/plans/image-import-speed-plan.md
 */
export declare const importImage: (sourcePath: string, projectPath: string) => Promise<CopyImageResult>;
