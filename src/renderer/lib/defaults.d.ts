/**
 * Default style values applied to every newly-created rectangle.
 *
 * The code generator only emits properties that differ from this object,
 * which keeps generated CSS clean. The parser applies these as a baseline
 * before overlaying parsed values, so missing properties round-trip as
 * defaults.
 */
export declare const DEFAULT_RECT_STYLES: {
    display: "none";
    flexDirection: "row";
    gap: number;
    alignItems: "flex-start";
    justifyContent: "flex-start";
    gridTemplateColumns: string;
    gridTemplateRows: string;
    columnGap: number;
    rowGap: number;
    justifyItems: "stretch";
    gridColumn: string;
    gridRow: string;
    alignSelf: "stretch";
    justifySelf: "stretch";
    padding: [number, number, number, number];
    margin: [number, number, number, number];
    widthMode: "fixed";
    widthValue: number;
    heightMode: "fixed";
    heightValue: number;
    backgroundColor: string;
    borderRadius: [number, number, number, number];
    borderWidth: [number, number, number, number];
    borderStyle: "none";
    borderColor: string;
    opacity: number;
    visibilityMode: "visible";
    position: "auto";
    transitions: ReadonlyArray<{
        property: string;
        durationMs: number;
        easing: string;
        delayMs: number;
    }>;
    inlineFragments: ReadonlyArray<{
        kind: "text";
        value: string;
        afterChildIndex: number;
    } | {
        kind: "jsx";
        source: string;
        afterChildIndex: number;
    }>;
};
export type DefaultRectStyles = typeof DEFAULT_RECT_STYLES;
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
export declare const DEFAULT_ROOT_STYLES: {
    display: "none";
    flexDirection: "row";
    gap: number;
    alignItems: "flex-start";
    justifyContent: "flex-start";
    gridTemplateColumns: string;
    gridTemplateRows: string;
    columnGap: number;
    rowGap: number;
    justifyItems: "stretch";
    gridColumn: string;
    gridRow: string;
    alignSelf: "stretch";
    justifySelf: "stretch";
    padding: [number, number, number, number];
    margin: [number, number, number, number];
    widthMode: "stretch";
    widthValue: number;
    heightMode: "auto";
    heightValue: number;
    /**
     * Page-root gets a `100vh` floor so generated pages have a visible
     * height in any browser (preview / `next dev` / production). Without
     * this, the root collapses to 0px because absolute children don't
     * contribute to its box. Users can override per-element via the
     * panel or per-breakpoint by setting a different `minHeight`.
     */
    minHeight: string;
    backgroundColor: string;
    borderRadius: [number, number, number, number];
    borderWidth: [number, number, number, number];
    borderStyle: "none";
    borderColor: string;
    opacity: number;
    visibilityMode: "visible";
    position: "auto";
    transitions: ReadonlyArray<{
        property: string;
        durationMs: number;
        easing: string;
        delayMs: number;
    }>;
    inlineFragments: ReadonlyArray<{
        kind: "text";
        value: string;
        afterChildIndex: number;
    } | {
        kind: "jsx";
        source: string;
        afterChildIndex: number;
    }>;
};
export type DefaultRootStyles = typeof DEFAULT_ROOT_STYLES;
