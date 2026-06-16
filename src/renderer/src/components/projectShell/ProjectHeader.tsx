import {
  IconCode,
  IconPlayerPlay,
  IconTerminal2,
} from '@tabler/icons-react';

import type { ProjectFormat } from '@shared/types';
import type { BottomPanel } from '@store/canvasSlice';

import { ZoomControls } from '../ZoomControls';
import { SaveStatusIndicator } from '../SaveStatusIndicator';
import { Tooltip } from '../controls/Tooltip';
import styles from '../ProjectShell.module.css';

type Props = {
  projectName: string;
  bottomPanel: BottomPanel;
  canPreview: boolean;
  projectFormat: ProjectFormat;
  onClose: () => void;
  onToggleCode: () => void;
  onToggleTerminal: () => void;
  onOpenPreview: () => void;
};

/** Top toolbar: back-to-projects, zoom, code/terminal/preview toggles. */
export const ProjectHeader = ({
  projectName,
  bottomPanel,
  canPreview,
  projectFormat,
  onClose,
  onToggleCode,
  onToggleTerminal,
  onOpenPreview,
}: Props): JSX.Element => {
  return (
    <header className={styles.toolbar}>
      <button className={styles.backButton} onClick={onClose} type="button">
        ← Projects
      </button>
      <span className={styles.spacer} />
      <ZoomControls />
      <Tooltip label="Toggle code panel">
        <button
          className={`${styles.toggleButton} ${
            bottomPanel === 'code' ? styles.toggleActive : ''
          }`}
          onClick={onToggleCode}
          type="button"
        >
          <IconCode size={14} className={styles.toggleButtonIcon} />
          Code
        </button>
      </Tooltip>
      <Tooltip label="Toggle terminal (Ctrl+`)">
        <button
          className={`${styles.toggleButton} ${
            bottomPanel === 'terminal' ? styles.toggleActive : ''
          }`}
          onClick={onToggleTerminal}
          type="button"
        >
          <IconTerminal2 size={14} className={styles.toggleButtonIcon} />
          Terminal
        </button>
      </Tooltip>
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
