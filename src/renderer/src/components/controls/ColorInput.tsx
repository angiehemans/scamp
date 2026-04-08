import { useEffect, useState } from 'react';
import styles from './Controls.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Native color picker plus a hex text field that mirrors it.
 *
 * The native `<input type="color">` only handles `#rrggbb`. When the stored
 * value isn't parseable as that format (e.g. `rgba(...)`, `transparent`,
 * `red`), the swatch falls back to black and a small note instructs the
 * user to switch to the CSS view to edit it.
 */
export const ColorInput = ({ value, onChange }: Props): JSX.Element => {
  const isHex = HEX_RE.test(value);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) {
      setDraft(value);
      return;
    }
    onChange(trimmed);
  };

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <input
          type="color"
          className={styles.colorSwatch}
          value={isHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
      {!isHex && (
        <span className={styles.hint}>
          Edit in CSS view to use named or rgba colors.
        </span>
      )}
    </div>
  );
};
