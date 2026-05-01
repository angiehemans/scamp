type Props = {
    projectPath: string;
};
/**
 * Fonts panel inside Project Settings. Users paste a Google Fonts
 * embed link and we persist the `@import` URL in `theme.css` — the
 * one project-level design-asset file. Removing an entry strips the
 * corresponding import.
 */
export declare const FontsSection: ({ projectPath }: Props) => JSX.Element;
export {};
