type Options = {
    /** Called when the user presses Escape. */
    onClose: () => void;
    /** When true, Escape is ignored (e.g. while a modal is mid-submit). */
    disabled?: boolean;
};
/**
 * Attach a document-level Escape listener that triggers `onClose`. Used
 * by modal dialogs so they all share the same close-on-Escape behavior
 * without each re-implementing the event wiring.
 */
export declare const useDialogBackdrop: ({ onClose, disabled }: Options) => void;
export {};
