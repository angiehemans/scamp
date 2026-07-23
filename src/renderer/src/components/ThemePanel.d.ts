type Props = {
    projectPath: string;
};
export type ThemeSectionId = 'colors' | 'typography' | 'spacing' | 'border' | 'radius' | 'shadow' | 'documentation' | 'unknown';
/**
 * Modal for managing project design tokens (CSS custom properties).
 * Tabs split tokens by inferred category (colors / typography / unknown).
 * Changes write to theme.css on disk; chokidar hot-reloads them.
 */
export declare const ThemePanel: ({ projectPath }: Props) => JSX.Element;
export {};
