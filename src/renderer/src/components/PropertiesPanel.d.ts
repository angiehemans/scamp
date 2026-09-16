import type { ReactNode } from 'react';
type Props = {
    /**
     * Page-level content for the empty state, above the shortcuts: the
     * Routes section of a Scamp-framework project. Passed in rather than
     * read here so this panel stays about the selected element.
     */
    routesSection?: ReactNode;
};
export declare const PropertiesPanel: ({ routesSection }: Props) => JSX.Element;
export {};
