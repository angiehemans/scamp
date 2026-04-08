import type { ReactNode } from 'react';
import styles from './Section.module.css';

type Props = {
  title: string;
  children: ReactNode;
};

/**
 * Card-like wrapper for one panel section. Renders a small heading and the
 * provided controls. Stacking and dividers are handled by `.section` so
 * each section component just yields its content.
 */
export const Section = ({ title, children }: Props): JSX.Element => {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{title}</h3>
      {children}
    </section>
  );
};

type RowProps = {
  label: string;
  children: ReactNode;
};

/** A labeled row inside a Section. Wraps the label and the control(s). */
export const Row = ({ label, children }: RowProps): JSX.Element => {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
};
