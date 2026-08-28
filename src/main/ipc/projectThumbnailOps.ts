import { promises as fs } from 'fs';
import { join } from 'path';

import type {
  ProjectReadThumbnailArgs,
  ProjectReadThumbnailResult,
  ProjectWriteThumbnailArgs,
  ProjectWriteThumbnailResult,
} from '@shared/types';

/**
 * The start-screen project thumbnail on disk.
 *
 * One PNG per project at `.scamp/preview.png` — a cropped capture of the
 * home page, written by the renderer after a home-page save. `.scamp/` is
 * gitignored by both scaffolds, so this is a local cache: a project cloned
 * to another machine shows its placeholder until it is opened and saved
 * there. That is deliberate. A screenshot of someone else's last session
 * is not project source.
 *
 * see docs/notes/project-thumbnails.md
 */

const FILE_NAME = 'preview.png';

export const thumbnailPathFor = (projectPath: string): string =>
  join(projectPath, '.scamp', FILE_NAME);

/**
 * Refuse anything implausible for a 640px-wide PNG.
 *
 * The renderer crops before sending, so a payload this size means
 * something upstream is wrong — a full-resolution capture of a very long
 * page, most likely. Writing it would put megabytes into the user's
 * project folder on every save, silently.
 */
export const MAX_THUMBNAIL_BYTES = 4 * 1024 * 1024;

const decodeDataUrl = (dataUrl: string): Buffer => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Malformed data URL');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
};

export const writeProjectThumbnail = async (
  args: ProjectWriteThumbnailArgs
): Promise<ProjectWriteThumbnailResult> => {
  try {
    const buf = decodeDataUrl(args.dataUrl);
    if (buf.byteLength === 0) {
      return { ok: false, error: 'Thumbnail was empty.' };
    }
    if (buf.byteLength > MAX_THUMBNAIL_BYTES) {
      return {
        ok: false,
        error: `Thumbnail too large (${buf.byteLength} bytes).`,
      };
    }
    const file = thumbnailPathFor(args.projectPath);
    await fs.mkdir(join(args.projectPath, '.scamp'), { recursive: true });
    await fs.writeFile(file, buf);
    return { ok: true, thumbnailPath: file };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Thumbnail write failed.',
    };
  }
};

export const readProjectThumbnail = async (
  args: ProjectReadThumbnailArgs
): Promise<ProjectReadThumbnailResult> => {
  try {
    const buf = await fs.readFile(thumbnailPathFor(args.projectPath));
    return { base64: buf.toString('base64') };
  } catch {
    // Missing is the normal case for a project that predates this
    // feature, so it is not an error — the card shows its placeholder.
    return { base64: null };
  }
};

/** For the projects list, which only needs to know whether to expect one. */
export const hasProjectThumbnail = async (
  projectPath: string
): Promise<boolean> => {
  try {
    await fs.access(thumbnailPathFor(projectPath));
    return true;
  } catch {
    return false;
  }
};
