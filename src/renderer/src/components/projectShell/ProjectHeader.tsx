import { IconPlayerPlay } from '@tabler/icons-react';

import type { ProjectFormat } from '@shared/types';

import { ZoomControls } from '../ZoomControls';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { Tooltip } from '../controls/Tooltip';
import styles from '../ProjectShell.module.css';

type Props = {
  projectName: string;
  canPreview: boolean;
  projectFormat: ProjectFormat;
  onClose: () => void;
  onOpenPreview: () => void;
};

/**
 * Top toolbar: back-to-projects, zoom, preview, save status, project name.
 *
 * The code and terminal toggles moved to the canvas toolbar (right-aligned,
 * icon-only) — they act on the canvas, so they belong with it.
 */
export const ProjectHeader = ({
  projectName,
  canPreview,
  projectFormat,
  onClose,
  onOpenPreview,
}: Props): JSX.Element => {
  return (
    <header className={styles.toolbar}>
      <button className={styles.backButton} onClick={onClose} type="button">
        ← Projects
      </button>
      <span className={styles.spacer} />
      <ZoomControls />
      <Tooltip
        label={
          canPreview
            ? 'Open this project in a real browser preview window (⌘P)'
            : projectFormat === 'legacy'
              ? 'Preview is only available for Next.js-format projects. Migrate this project to enable preview.'
              : 'Open a page to enable preview.'
        }
      >
        <button
          className={styles.toggleButton}
          onClick={onOpenPreview}
          type="button"
          disabled={!canPreview}
          data-testid="preview-button"
        >
          <IconPlayerPlay size={14} className={styles.toggleButtonIcon} />
          Preview
        </button>
      </Tooltip>
      <SaveStatusIndicator />
      <span className={styles.projectName}>{projectName}</span>
    </header>
  );
};
