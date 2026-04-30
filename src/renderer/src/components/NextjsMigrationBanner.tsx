import { useState } from 'react';
import { Button } from './controls/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { useAppLogStore } from '@store/appLogSlice';
import type { ProjectData } from '@shared/types';
import styles from './NextjsMigrationBanner.module.css';

type Props = {
  project: ProjectData;
  onMigrated: (next: ProjectData) => void;
  onDismiss: () => void;
};

/**
 * Shown above the canvas on legacy-format projects. Offers an opt-in
 * one-click migration to the Next.js App Router layout. Dismissal is
 * persisted per-project (in `scamp.config.json`) by the parent so the
 * banner stays out of the way for users who don't want to migrate.
 */
export const NextjsMigrationBanner = ({
  project,
  onMigrated,
  onDismiss,
}: Props): JSX.Element => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const log = useAppLogStore((s) => s.log);

  const handleMigrate = async (): Promise<void> => {
    setMigrating(true);
    try {
      const result = await window.scamp.migrateProject({
        projectPath: project.path,
      });
      log(
        'info',
        `Migrated to Next.js format. Originals saved to ${result.backupPath}.`
      );
      onMigrated(result.project);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', `Migration failed: ${message}`);
    } finally {
      setMigrating(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className={styles.banner} role="status">
        <div className={styles.content}>
          <span className={styles.icon} aria-hidden="true">
            ℹ
          </span>
          <div className={styles.text}>
            <strong className={styles.title}>
              This project uses the legacy file structure
            </strong>
            <span className={styles.message}>
              New Scamp projects use the Next.js App Router layout
              (<code>app/page.tsx</code>, <code>public/assets/</code>) so
              they can be opened directly in a Next.js workspace. Migrate
              when convenient — your original files are saved to a backup
              folder you can recover from.
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowConfirm(true)}
            disabled={migrating}
          >
            {migrating ? 'Migrating…' : 'Migrate to Next.js format'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onDismiss}
            disabled={migrating}
          >
            Dismiss
          </Button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title={`Migrate ${project.name} to Next.js format?`}
          message={
            'Scamp will reorganise this project into the Next.js App Router layout. Your original files will be moved into a sibling backup folder (.scamp-backup-…) inside the project, so nothing is destroyed.'
          }
          confirmLabel="Migrate"
          variant="primary"
          onConfirm={() => void handleMigrate()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};
