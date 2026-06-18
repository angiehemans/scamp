import { Button } from './controls/Button';
import styles from './ParseErrorBanner.module.css';

type Props = {
  /** Name of the page or component whose source failed to parse. */
  targetName: string;
  onDismiss: () => void;
};

/**
 * Shown above the canvas when `parseCode` throws on the active page or
 * component — usually because an agent or hand-edit left the file in a
 * transiently invalid state mid-write. The canvas keeps showing the
 * last successfully-parsed state instead of silently blanking. Cleared
 * by re-selecting the target (a clean parse) or by dismissing.
 */
export const ParseErrorBanner = ({ targetName, onDismiss }: Props): JSX.Element => {
  return (
    <div className={styles.banner} role="alert">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          ⚠
        </span>
        <div className={styles.text}>
          <strong className={styles.title}>
            Couldn&rsquo;t parse &ldquo;{targetName}&rdquo;
          </strong>
          <span className={styles.message}>
            The canvas is showing the last version that loaded cleanly. Fix
            the file&rsquo;s syntax, then re-select it to continue editing.
            See the activity log for the error.
          </span>
        </div>
      </div>
      <div className={styles.dismissWrap}>
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
};
