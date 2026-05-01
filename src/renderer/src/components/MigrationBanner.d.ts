type Props = {
    onDismiss: () => void;
};
/**
 * One-time notice shown when the project's root CSS was detected in
 * the legacy fixed-pixel format and migrated to the new
 * `width: 100%; height: auto` defaults. Displayed above the canvas;
 * the user dismisses it explicitly and it never reappears for this
 * project.
 */
export declare const MigrationBanner: ({ onDismiss }: Props) => JSX.Element;
export {};
