type Props = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Visual style for the confirm button. */
    variant?: 'primary' | 'destructive';
    /** Inline error (e.g. IPC failure) shown under the message; keeps the dialog open. */
    error?: string | null;
    onConfirm: () => void;
    onCancel: () => void;
};
/**
 * A small modal for confirming destructive or irreversible actions.
 * Intentionally generic so it can be reused for deletes, overwrites,
 * and anywhere else we need a yes/no prompt.
 */
export declare const ConfirmDialog: ({ title, message, confirmLabel, cancelLabel, variant, error, onConfirm, onCancel, }: Props) => JSX.Element;
export {};
