import styles from './MigrationBanner.module.css';

type Props = {
  onDismiss: () => void;
};

/**
 * One-time notice shown when the project's root CSS was detected in
 * the legacy fixed-pixel format and migrated to the new
 * `width: 100%; height: auto` defaults. Displayed above the canvas;
 * the user dismisses it explicitly and it never reappears for this
 * project.
 */
export const MigrationBanner = ({ onDismiss }: Props): JSX.Element => {
  return (
    <div className={styles.banner} role="status">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          ℹ
        </span>
        <div className={styles.text}>
          <strong className={styles.title}>
            Canvas size moved out of your CSS
          </strong>
          <span className={styles.message}>
            Scamp no longer writes <code>width</code> / <code>min-height</code>{' '}
            on the root. The canvas width now lives in the toolbar, and the
            root defaults to <code>width: 100%</code> so your exported code
            works anywhere. Adjust the canvas from the new size control in
            the toolbar.
          </span>
        </div>
      </div>
      <button
        className={styles.dismiss}
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        Got it
      </button>
    </div>
  );
};
