import { useState } from 'react';
import { NumberInput } from './NumberInput';
import styles from './Controls.module.css';

type FourSideValue = [number, number, number, number];

type Props = {
  value: FourSideValue;
  onChange: (next: FourSideValue) => void;
  /** Minimum allowed per-side value (inclusive). */
  min?: number;
};

/**
 * Edits a [top, right, bottom, left] tuple with a "linked" mode (one value
 * applies to all four sides) and an "expanded" mode (four separate inputs).
 *
 * The link toggle is local UI state — switching modes does not write
 * anything. The control starts in linked mode when all four sides match,
 * otherwise expanded.
 */
export const FourSideInput = ({ value, onChange, min = 0 }: Props): JSX.Element => {
  const allEqual = value[0] === value[1] && value[1] === value[2] && value[2] === value[3];
  const [linked, setLinked] = useState(allEqual);

  const setSide = (idx: 0 | 1 | 2 | 3, next: number | undefined): void => {
    const n = next ?? 0;
    const out = [...value] as FourSideValue;
    out[idx] = n;
    onChange(out);
  };

  const setAll = (next: number | undefined): void => {
    const n = next ?? 0;
    onChange([n, n, n, n]);
  };

  return (
    <div className={styles.fourSide}>
      <div className={styles.fourSideHeader}>
        <button
          type="button"
          className={`${styles.linkButton} ${linked ? styles.linkButtonActive : ''}`}
          onClick={() => setLinked((v) => !v)}
          title={linked ? 'Linked — one value applies to all four sides' : 'Expanded — edit each side independently'}
        >
          {linked ? '⛓ Linked' : '⛓ Expanded'}
        </button>
      </div>
      {linked ? (
        <NumberInput value={value[0]} onChange={setAll} min={min} />
      ) : (
        <div className={styles.fourSideExpanded}>
          <div className={styles.fourSideCell}>
            <span className={styles.fourSideCellLabel}>T</span>
            <NumberInput value={value[0]} onChange={(n) => setSide(0, n)} min={min} />
          </div>
          <div className={styles.fourSideCell}>
            <span className={styles.fourSideCellLabel}>R</span>
            <NumberInput value={value[1]} onChange={(n) => setSide(1, n)} min={min} />
          </div>
          <div className={styles.fourSideCell}>
            <span className={styles.fourSideCellLabel}>B</span>
            <NumberInput value={value[2]} onChange={(n) => setSide(2, n)} min={min} />
          </div>
          <div className={styles.fourSideCell}>
            <span className={styles.fourSideCellLabel}>L</span>
            <NumberInput value={value[3]} onChange={(n) => setSide(3, n)} min={min} />
          </div>
        </div>
      )}
    </div>
  );
};
