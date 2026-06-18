type Props = {
    /** Name of the page or component whose source failed to parse. */
    targetName: string;
    onDismiss: () => void;
};
/**
 * Shown above the canvas when `parseCode` throws on the active page or
 * component — usually because an agent or hand-edit left the file in a
 * transiently invalid state mid-write. The canvas keeps showing the
 * last successfully-parsed state instead of silently blanking. Cleared
 * by re-selecting the target (a clean parse) or by dismissing.
 */
export declare const ParseErrorBanner: ({ targetName, onDismiss }: Props) => JSX.Element;
export {};
