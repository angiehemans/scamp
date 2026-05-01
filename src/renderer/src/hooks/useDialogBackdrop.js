import { useEffect } from 'react';
/**
 * Attach a document-level Escape listener that triggers `onClose`. Used
 * by modal dialogs so they all share the same close-on-Escape behavior
 * without each re-implementing the event wiring.
 */
export const useDialogBackdrop = ({ onClose, disabled = false }) => {
    useEffect(() => {
        if (disabled)
            return;
        const handleKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose, disabled]);
};
