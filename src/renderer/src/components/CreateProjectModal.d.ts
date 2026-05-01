type Props = {
    defaultFolder: string;
    onSubmit: (name: string) => Promise<void>;
    onCancel: () => void;
};
/**
 * Modal dialog for creating a new project. Handles name input, validation,
 * auto-suggest on blur, and path hint. The parent owns the actual IPC call
 * and passes it via `onSubmit`.
 */
export declare const CreateProjectModal: ({ defaultFolder, onSubmit, onCancel, }: Props) => JSX.Element;
export {};
