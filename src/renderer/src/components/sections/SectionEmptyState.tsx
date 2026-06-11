import type { ReactNode } from 'react';

import styles from './Section.module.css';

type Props = {
  /**
   * data-testid for e2e assertions that the section is empty (e.g.
   * `shadows-empty`).
   */
  testId?: string;
  children?: ReactNode;
};

/**
 * The empty-state indicator a list section renders when it has no
 * rows. Uses the shared `.row` / `.rowLabel` classes — note
 * `.rowLabel` is `display: none`, so this is primarily a DOM marker
 * for e2e (`data-testid`) rather than visible chrome. Kept byte-for-
 * byte identical to the inline copies it replaces in Filters /
 * Transitions / Shadows so the consolidation changes nothing visually.
 */
export const SectionEmptyState = ({
  testId,
  children = 'None',
}: Props): JSX.Element => (
  <div className={styles.row}>
    <span className={styles.rowLabel} data-testid={testId}>
      {children}
    </span>
  </div>
);
