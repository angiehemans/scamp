/**
 * Default style values applied to every newly-created rectangle.
 *
 * The code generator only emits properties that differ from this object,
 * which keeps generated CSS clean. The parser applies these as a baseline
 * before overlaying parsed values, so missing properties round-trip as
 * defaults.
 */
export const DEFAULT_RECT_STYLES = {
    display: 'none',
    flexDirection: 'row',
    gap: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gridTemplateColumns: '',
    gridTemplateRows: '',
    columnGap: 0,
    rowGap: 0,
    justifyItems: 'stretch',
    gridColumn: '',
    gridRow: '',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    widthMode: 'fixed',
    widthValue: 100,
    heightMode: 'fixed',
    heightValue: 100,
    backgroundColor: 'transparent',
    borderRadius: [0, 0, 0, 0],
    borderWidth: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: '#000000',
    opacity: 1,
    visibilityMode: 'visible',
    position: 'auto',
    transitions: [],
    inlineFragments: [],
};
/**
 * Defaults for the page-root element.
 *
 * The root is treated like any other rectangle for emission purposes —
 * there's no root-specific sizing branch in `generateCode` — but its
 * DEFAULTS differ: a white page background, and web-idiomatic
 * sizing (`width: 100%; height: auto`) that works outside Scamp
 * without assuming a specific viewport.
 *
 * Both `generateCode` and `parseCode` use this object as the baseline
 * for the root so the user can override any property from the panel
 * and have them round-trip cleanly.
 *
 * The `widthValue` / `heightValue` numbers are fallbacks used only
 * when the user switches the corresponding mode to 'fixed' from the
 * panel — they have no effect in the default stretch/auto mode.
 */
export const DEFAULT_ROOT_STYLES = {
    display: 'none',
    flexDirection: 'row',
    gap: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gridTemplateColumns: '',
    gridTemplateRows: '',
    columnGap: 0,
    rowGap: 0,
    justifyItems: 'stretch',
    gridColumn: '',
    gridRow: '',
    alignSelf: 'stretch',
    justifySelf: 'stretch',
    padding: [0, 0, 0, 0],
    margin: [0, 0, 0, 0],
    widthMode: 'stretch',
    widthValue: 1440,
    heightMode: 'auto',
    heightValue: 900,
    /**
     * Page-root gets a `100vh` floor so generated pages have a visible
     * height in any browser (preview / `next dev` / production). Without
     * this, the root collapses to 0px because absolute children don't
     * contribute to its box. Users can override per-element via the
     * panel or per-breakpoint by setting a different `minHeight`.
     */
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    borderRadius: [0, 0, 0, 0],
    borderWidth: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: '#000000',
    opacity: 1,
    visibilityMode: 'visible',
    position: 'auto',
    transitions: [],
    inlineFragments: [],
};
