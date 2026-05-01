type Props = {
    elementId: string;
};
/**
 * Collapsible "Element" section that appears at the top of the
 * properties panel for every element type. Lets the user pick the
 * element's HTML tag and edit tag-specific attributes (href, method,
 * etc.). For `<select>` and `<svg>` the section renders a dedicated
 * editor instead of a plain attribute form.
 */
export declare const ElementSection: ({ elementId }: Props) => JSX.Element | null;
export {};
