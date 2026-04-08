import styles from './Controls.module.css';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/**
 * A single labeled boolean. Renders the label and a checkbox in a row.
 * Reserved for future use — no current section needs it, but keeping it
 * in the controls/ catalogue per the plan.
 */
export const ToggleRow = ({ label, value, onChange }: Props): JSX.Element => {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.label}>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
};
