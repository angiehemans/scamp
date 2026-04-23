import { useEffect } from 'react';
import { useDialogBackdrop } from '../hooks/useDialogBackdrop';
import { Button } from './controls/Button';
import styles from './ConfirmDialog.module.css';

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual style for the confirm button. */
  variant?: 'primary' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A small modal for confirming destructive or irreversible actions.
 * Intentionally generic so it can be reused for deletes, overwrites,
 * and anywhere else we need a yes/no prompt.
 */
export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: Props): JSX.Element => {
  useDialogBackdrop({ onClose: onCancel });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onConfirm]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
