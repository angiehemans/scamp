export const WRITE_DEBOUNCE_MS = 200;
/**
 * The CSS-module file basename `generateCode` should put in the TSX
 * import line for the given project format. Nextjs projects always
 * import `./page.module.css` (each page lives in its own folder); the
 * legacy flat layout imports `./<pageName>.module.css`.
 */
const cssModuleImportNameFor = (format, pageName) => (format === 'nextjs' ? 'page' : pageName);
export const toEditTarget = (page, component) => {
    // activeComponent takes precedence — `loadComponent` clears
    // `activePage` and vice versa, so this defensive ordering only
    // matters during the in-flight setState batch where both may
    // briefly be readable.
    if (component) {
        return {
            kind: 'component',
            name: component.name,
            tsxPath: component.tsxPath,
            cssPath: component.cssPath,
        };
    }
    if (page) {
        return {
            kind: 'page',
            name: page.name,
            tsxPath: page.tsxPath,
            cssPath: page.cssPath,
        };
    }
    return null;
};
/**
 * CSS-module import name for the active target. Pages route
 * through `cssModuleImportNameFor` (which depends on project
 * format); components always import their own
 * `./<ComponentName>.module.css` regardless of project format.
 */
export const importNameForTarget = (target, format) => {
    if (target.kind === 'component')
        return target.name;
    return cssModuleImportNameFor(format, target.name);
};
