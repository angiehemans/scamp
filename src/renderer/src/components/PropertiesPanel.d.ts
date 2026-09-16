import type { ReactNode } from 'react';
type Props = {
    /**
     * Page-level content for the empty state, above the shortcuts: the
     * Routes section of a Scamp-framework project. Passed in rather than
     * read here so this panel stays about the selected element.
     */
    routesSection?: ReactNode;
    /**
     * An offer that belongs to the project rather than to an element: the
     * Next.js → Scamp framework migration. Below the page's own sections,
     * above the shortcuts. see docs/notes/nextjs-sunset.md
     */
    migrationNotice?: ReactNode;
};
export declare const PropertiesPanel: ({ routesSection, migrationNotice, }: Props) => JSX.Element;
export {};
