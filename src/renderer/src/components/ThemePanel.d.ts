type Props = {
    projectPath: string;
    onClose: () => void;
};
/**
 * Modal for managing project design tokens (CSS custom properties).
 * Tabs split tokens by inferred category (colors / typography / unknown).
 * Changes write to theme.css on disk; chokidar hot-reloads them.
 */
export declare const ThemePanel: ({ projectPath, onClose }: Props) => JSX.Element;
export {};
