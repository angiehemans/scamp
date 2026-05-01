/**
 * The raw CSS editor view of the properties panel. Scopes its body
 * to the active breakpoint: at desktop it shows the base class's
 * declarations; at any other breakpoint it shows just the overrides
 * that would land in that @media block. Commits route through
 * `savePatch` with the matching `media` scope.
 */
export declare const CssPanel: () => JSX.Element;
