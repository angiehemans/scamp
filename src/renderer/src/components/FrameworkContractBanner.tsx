import { Button } from './controls/Button';
import type { FrameworkInfo } from '@shared/types';
import { SUPPORTED_CONTRACT, isSupportedContract } from '@shared/projectConfig';
import styles from './ParseErrorBanner.module.css';

type Props = {
  framework: FrameworkInfo;
  onDismiss: () => void;
};

/**
 * Shown above the canvas of a scamp-format project whose installed
 * `scampjs` is missing or implements a contract this build can't read
 * or write. The app still opens the project; the banner says what to
 * install. Renders nothing when the install is in range.
 * see docs/plans/framework-phase-1-plan.md, step 6
 */
export const FrameworkContractBanner = ({ framework, onDismiss }: Props): JSX.Element | null => {
  const installed = framework.installedVersion !== null;
  if (installed && isSupportedContract(framework.contract)) return null;
  const range =
    SUPPORTED_CONTRACT.min === SUPPORTED_CONTRACT.max
      ? `${SUPPORTED_CONTRACT.max}`
      : `${SUPPORTED_CONTRACT.min}–${SUPPORTED_CONTRACT.max}`;
  const title = installed
    ? `This project's scampjs uses contract ${framework.contract ?? '?'}`
    : 'scampjs isn’t installed in this project';
  const message = installed
    ? `This version of Scamp supports contract ${range}. Update Scamp, or install a scampjs release that implements contract ${range}, before editing — a save would write the older shape.`
    : `Run npm install in the project folder to get the version its package.json asks for. Scamp can read and edit the files without it, but previews and builds need it.`;
  return (
    <div className={styles.banner} role="status" data-testid="framework-contract-banner">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">
          ℹ
        </span>
        <div className={styles.text}>
          <strong className={styles.title}>{title}</strong>
          <span className={styles.message}>{message}</span>
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
