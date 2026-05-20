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
export declare const CreateComponentDialog: ({ existingNames, error, busy, onConfirm, onCancel, }: Props) => JSX.Element;
export {};
