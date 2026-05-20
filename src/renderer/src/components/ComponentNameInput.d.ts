type Props = {
    initialValue?: string;
    /** Other component names in the project — drives collision feedback. */
    existingNames: ReadonlyArray<string>;
    onConfirm: (name: string) => void;
    onCancel: () => void;
    /** External error message (e.g. IPC failure) shown under the input. */
    error?: string | null;
    /** When true, input is read-only and shows a loading indicator. */
    busy?: boolean;
};
/**
 * Inline text input for naming a new component. Mirror of
 * `PageNameInput` — focuses on mount, validates per-keystroke,
 * Enter confirms (when valid), Escape cancels, blur cancels.
 *
 * On confirm, the user's input is passed through
 * `suggestComponentName` so casual entries like `hero card` get
 * promoted to `HeroCard`. The post-suggestion result is what gets
 * sent to `createComponent` — main-side validation runs on the
 * same shape, so there's no surprise rejection.
 */
export declare const ComponentNameInput: ({ initialValue, existingNames, onConfirm, onCancel, error: externalError, busy, }: Props) => JSX.Element;
export {};
