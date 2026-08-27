import {
  IconAlertTriangle,
  IconCheck,
  IconCode,
  IconLoader2,
  IconPlayerPlay,
} from '@tabler/icons-react';

import type { ProjectFormat } from '@shared/types';
import {
  exportButtonLabel,
  exportButtonTooltip,
  type HtmlExportStatus,
} from '@lib/htmlExportStatus';

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
  onExportHtml: () => void;
  exportStatus: HtmlExportStatus;
  exportMessage: string | null;
  exportLocation: string | null;
};

const exportStatusClass: Record<HtmlExportStatus, string> = {
  idle: '',
  exporting: styles.toggleButtonBusy ?? '',
  done: styles.toggleButtonDone ?? '',
  error: styles.toggleButtonError ?? '',
};

/** Leading icon, which is the at-a-glance signal of what the button is doing. */
const ExportIcon = ({ status }: { status: HtmlExportStatus }): JSX.Element => {
  if (status === 'exporting') {
    return (
      <IconLoader2
        size={14}
        className={`${styles.toggleButtonIcon} ${styles.spinning}`}
      />
    );
  }
  if (status === 'done') {
    return <IconCheck size={14} className={styles.toggleButtonIcon} />;
  }
  if (status === 'error') {
    return <IconAlertTriangle size={14} className={styles.toggleButtonIcon} />;
  }
  return <IconCode size={14} className={styles.toggleButtonIcon} />;
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
  onExportHtml,
  exportStatus,
  exportMessage,
  exportLocation,
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
      <Tooltip label={exportButtonTooltip(exportStatus, exportMessage, exportLocation)}>
        <button
          className={`${styles.toggleButton} ${exportStatusClass[exportStatus] ?? ''}`}
          onClick={onExportHtml}
          type="button"
          disabled={exportStatus === 'exporting'}
          data-testid="export-html-button"
          data-export-status={exportStatus}
        >
          <ExportIcon status={exportStatus} />
          {exportButtonLabel(exportStatus, exportMessage)}
        </button>
      </Tooltip>
      <SaveStatusIndicator />
      <span className={styles.projectName}>{projectName}</span>
    </header>
  );
};
