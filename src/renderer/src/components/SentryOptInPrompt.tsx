import { useEffect } from 'react';
import { Button } from './controls/Button';
import styles from './SentryOptInPrompt.module.css';

type Props = {
  /** Called with the user's choice. The caller is responsible for
   *  writing the pref + re-initialising Sentry. */
  onDecision: (optedIn: boolean) => void;
};

/**
 * First-launch crash-reporting opt-in prompt. Rendered by `App.tsx`
 * before `<StartScreen>` when `settings.sentryOptIn` is `null` (i.e.
 * the user has not been asked yet). Calling `onDecision(true)` or
 * `onDecision(false)` writes the pref via the IPC bridge and
 * re-renders the app normally.
 *
 * Intentionally NOT dismissible by clicking the backdrop — the user
 * has to make an explicit choice. Pressing Escape counts as "No
 * thanks" (the privacy-preserving default).
 */
export const SentryOptInPrompt = ({ onDecision }: Props): JSX.Element => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDecision(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onDecision(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDecision]);

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentry-opt-in-title"
      >
        <h2 id="sentry-opt-in-title" className={styles.title}>
          Help improve Scamp
        </h2>
        <p className={styles.message}>
          Send anonymous crash reports when something goes wrong. No
          personal data, no project files, no file contents — only
          error details and your OS and app version.
        </p>
        <p className={styles.messageSecondary}>
          You can change this at any time in Settings.
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => onDecision(false)}>
            No thanks
          </Button>
          <Button
            variant="primary"
            onClick={() => onDecision(true)}
            autoFocus
          >
            Send crash reports
          </Button>
        </div>
      </div>
    </div>
  );
};
