import { useState, type ReactNode } from 'react';
import styles from './Section.module.css';

type Props = {
  title: string;
  children: ReactNode;
  /** When true, the heading acts as a disclosure toggle. */
  collapsible?: boolean;
  /** Initial open state when `collapsible` is true. Ignored otherwise. */
  defaultOpen?: boolean;
};

/**
 * Card-like wrapper for one panel section. Renders a small heading and the
 * provided controls. Stacking and dividers are handled by `.section` so
 * each section component just yields its content.
 *
 * When `collapsible` is true, the heading is a button; clicking it
 * toggles visibility of the children.
 */
export const Section = ({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: Props): JSX.Element => {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>{title}</h3>
        {children}
      </section>
    );
  }

  const handleToggle = (): void => setOpen((v) => !v);
  return (
    <section className={styles.section}>
      <button
        className={styles.toggle}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span className={styles.caret} aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className={styles.heading}>{title}</span>
      </button>
      {open && children}
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
