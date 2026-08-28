import { useEffect, useState } from 'react';

import styles from './ProjectCardThumb.module.css';

/**
 * The image area at the top of a start-screen project card.
 *
 * Loads `.scamp/preview.png` for its own project, like
 * `ComponentSidebarItem` does for components. When there is no thumbnail
 * — a project not saved since this shipped, or one cloned from elsewhere,
 * since `.scamp/` is gitignored — the area stays empty and the card's
 * `cardBackground` shows through. The block keeps its height either way so
 * the grid stays even.
 *
 * see docs/notes/project-thumbnails.md
 */

type Props = {
  projectPath: string;
  /** From the projects list, so a card with none never flashes an image in. */
  hasThumbnail: boolean;
};

export const ProjectCardThumb = ({
  projectPath,
  hasThumbnail,
}: Props): JSX.Element => {
  const [base64, setBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!hasThumbnail) {
      setBase64(null);
      return;
    }
    let cancelled = false;
    void window.scamp
      .readProjectThumbnail({ projectPath })
      .then((result) => {
        if (!cancelled) setBase64(result.base64);
      })
      .catch(() => {
        // A thumbnail that will not load is not worth surfacing — the
        // placeholder is a perfectly good card.
        if (!cancelled) setBase64(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, hasThumbnail]);

  return (
    <span className={styles.thumb} data-testid="project-card-thumb">
      {base64 !== null && (
        <img
          className={styles.image}
          src={`data:image/png;base64,${base64}`}
          alt=""
        />
      )}
    </span>
  );
};
