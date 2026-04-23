import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useState,
} from 'react';
import { Tooltip } from './Tooltip';
import styles from './Controls.module.css';

type Props = {
  /** Current committed value — reflected into the input text. */
  value: string;
  /** Called on blur or Enter with the trimmed draft. The parent may
   * accept (call its own onChange) or ignore (draft reverts to `value`
   * via the useEffect sync). */
  onCommit: (value: string) => void;
  /** Optional per-keystroke observer. Mostly unused. */
  onDraftChange?: (draft: string) => void;
  /** Label inside the row's left edge (e.g. "W", "Sz") or a custom node. */
  prefix?: ReactNode;
  /** Node at the row's right edge (unit indicator, picker button, caret). */
  suffix?: ReactNode;
  /** Removes the row's left padding + gap so a flush-mounted swatch or
   * border-radius prefix can sit against the outer border. */
  flushPrefix?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  /** Tooltip shown on hover of the whole row. */
  title?: string;
  disabled?: boolean;
  /** ArrowUp / ArrowDown handler — parent implements numeric stepping. */
  onArrow?: (draft: string, direction: 1 | -1, shift: boolean) => void;
  /** Stop shortcut keys (V, R, T, I, …) from firing while the user types. */
  stopKeyPropagation?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** Extra className on the <input>. Rare. */
  inputClassName?: string;
  /** Spellcheck on the input. Default false — most inputs hold identifiers. */
  spellCheck?: boolean;
  autoCapitalize?: 'off' | 'on' | 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: 'off' | 'on';
};

/**
 * Shared prefix + input + suffix row. Owns local draft state so the
 * caller only sees committed values. On blur, calls `onCommit` then
 * restores the draft to `value`; if the caller updates `value` in
 * response, the effect below syncs the draft forward — so a valid
 * commit reads as "draft moves to new value" and an invalid one reads
 * as "draft reverts".
 */
export const PrefixSuffixInput = ({
  value,
  onCommit,
  onDraftChange,
  prefix,
  suffix,
  flushPrefix = false,
  placeholder,
  inputMode = 'text',
  title,
  disabled = false,
  onArrow,
  stopKeyPropagation = false,
  inputRef,
  inputClassName,
  spellCheck = false,
  autoCapitalize,
  autoCorrect,
}: Props): JSX.Element => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
      return;
    }
    if (onArrow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      onArrow(draft, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
      return;
    }
    if (stopKeyPropagation) e.stopPropagation();
  };

  const rowClass = flushPrefix
    ? `${styles.colorInputRow} ${styles.colorInputRowSwatch}`
    : styles.colorInputRow;

  const row = (
    <div className={rowClass}>
      {prefix !== undefined &&
        (typeof prefix === 'string' ? (
          <span className={styles.inputPrefix}>{prefix}</span>
        ) : (
          prefix
        ))}
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        className={`${styles.colorText} ${inputClassName ?? ''}`}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={spellCheck}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onChange={(e) => {
          setDraft(e.target.value);
          onDraftChange?.(e.target.value);
        }}
        onBlur={() => {
          onCommit(draft.trim());
          setDraft(value);
        }}
        onKeyDown={handleKeyDown}
      />
      {suffix !== undefined &&
        (typeof suffix === 'string' ? (
          <span className={styles.inputSuffix}>{suffix}</span>
        ) : (
          suffix
        ))}
    </div>
  );

  return title ? <Tooltip label={title}>{row}</Tooltip> : row;
};
