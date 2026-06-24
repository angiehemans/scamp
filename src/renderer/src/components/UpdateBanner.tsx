import { useEffect, useState } from 'react';

import { useSaveStatusStore } from '@store/saveStatusSlice';

import { Button } from './controls/Button';
import { describeUpdateError } from './updateError';
import styles from './UpdateBanner.module.css';

/**
 * Bottom-of-window banner for the auto-updater. Non-modal and
 * non-blocking — it slides up when a download starts, shows progress,
 * and offers "Restart and install" once an update is ready. Dismissing
 * the ready/error banner doesn't cancel the update: it still installs
 * on next launch via `autoInstallOnAppQuit` (see docs/notes/auto-update.md).
 *
 * Mounted once near the React root so it's independent of which view is
 * active (Start Screen, project, settings).
 */
type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; version: string }
  | { kind: 'error'; message: string };

export const UpdateBanner = (): JSX.Element | null => {
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  // Don't interrupt an in-flight save with the install prompt — wait for
  // the save-status indicator to settle back to "Saved".
  const saving = useSaveStatusStore((s) => s.state.kind === 'saving');

  useEffect(() => {
    const offAvailable = window.scamp.onUpdaterAvailable(() => {
      setDismissed(false);
      setStatus({ kind: 'downloading', percent: 0 });
    });
    const offProgress = window.scamp.onUpdaterProgress((progress) => {
      setStatus({ kind: 'downloading', percent: Math.round(progress.percent) });
    });
    const offDownloaded = window.scamp.onUpdaterDownloaded((info) => {
      setDismissed(false);
      setStatus({ kind: 'ready', version: info.version });
    });
    const offError = window.scamp.onUpdaterError((message) => {
      setDismissed(false);
      setStatus({ kind: 'error', message: describeUpdateError(message) });
    });
    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  if (status.kind === 'idle' || dismissed) return null;
  if (status.kind === 'ready' && saving) return null;

  const handleInstall = (): void => {
    void window.scamp.installUpdateNow();
  };
  const handleDismiss = (): void => setDismissed(true);

  return (
    <div
      className={styles.banner}
      role="status"
      aria-live="polite"
      data-testid="update-banner"
    >
      {status.kind === 'downloading' && (
        <span className={styles.message}>
          Downloading update… {status.percent}%
        </span>
      )}

      {status.kind === 'ready' && (
        <>
          <span className={styles.message}>
            Scamp {status.version} is ready to install
          </span>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={handleInstall}>
              Restart and install
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Later
            </Button>
          </div>
        </>
      )}

      {status.kind === 'error' && (
        <>
          <span className={styles.message}>{status.message}</span>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
