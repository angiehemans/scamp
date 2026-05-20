import { useEffect } from 'react';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { ComponentNameInput } from './ComponentNameInput';
import styles from './ConfirmDialog.module.css';

type Props = {
  /** Component names already in the project — drives collision feedback. */
  existingNames: ReadonlyArray<string>;
  /** External error from the IPC call (e.g. write failure). */
  error?: string | null;
  /** Disables the input while the create IPC is in flight. */
  busy?: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

/**
 * Modal prompting for a PascalCase component name. Used by the
 * canvas "Create component…" right-click action — the user picks
 * an element, this dialog asks for a name, and the convert-to-
 * component flow runs on confirm.
 *
 * Reuses `ConfirmDialog`'s backdrop CSS so the visual treatment
 * matches the rest of Scamp's modal surfaces. Enter on the input
 * submits; Escape / outside-click cancels.
 */
export const CreateComponentDialog = ({
  existingNames,
  error,
  busy,
  onConfirm,
  onCancel,
}: Props): JSX.Element => {
  useDialogBackdrop({ onClose: onCancel });

  // Keep the dialog's surface from swallowing Enter / Escape inside
  // the underlying input (`ComponentNameInput` handles them itself).
  useEffect(() => {
    // No-op: backdrop handles Escape; Enter is owned by the input.
  }, []);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>Create component</h2>
        <p className={styles.message}>
          Pick a PascalCase name. Scamp will write
          <code> components/&lt;Name&gt;/&lt;Name&gt;.tsx</code> and
          replace the selected element with an instance.
        </p>
        <ComponentNameInput
          existingNames={existingNames}
          onConfirm={onConfirm}
          onCancel={onCancel}
          error={error}
          busy={busy}
        />
      </div>
    </div>
  );
};
