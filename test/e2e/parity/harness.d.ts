import { type Browser, type Page } from '@playwright/test';
/**
 * Machinery for comparing what the canvas lays out against what a browser
 * lays out from the same source files.
 *
 * The browser side deliberately imports NOTHING from `src/`. An oracle
 * that shares code with the thing it checks can agree with it while both
 * are wrong, so the fixture carries hand-written HTML and this module only
 * wraps it in a document with the page's CSS applied verbatim. The
 * document shell mirrors the project's own `app/layout.tsx` so the body
 * reset matches what the preview would use.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */
export type Box = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type Geometry = Record<string, Box>;
/**
 * Measure every Scamp element in the document, relative to the page root
 * and normalised out of any canvas zoom.
 *
 * Elements are keyed by their Scamp class name, which both sides carry:
 * the canvas puts it on `data-scamp-id`, the exporter emits it as `class`.
 *
 * Runs inside the page, so it must be self-contained.
 */
export declare const MEASURE_SCRIPT = "(() => {\n  // Inside a component instance the element names are the COMPONENT's, so\n  // a page root and a component root are both \"root\". Qualify by the\n  // owning instance so the two don't collide \u2014 and so both sides key the\n  // same way, since the browser document marks instances the same way.\n  const instanceOf = (el) => {\n    const host = el.closest('[data-scamp-instance-id]');\n    return host ? host.getAttribute('data-scamp-instance-id') : null;\n  };\n  const read = (el) => {\n    const own = el.getAttribute('data-scamp-id') || el.className;\n    if (typeof own !== 'string') return own;\n    const inst = instanceOf(el);\n    return inst ? inst + '/' + own : own;\n  };\n  const nodes = Array.from(\n    document.querySelectorAll('[data-scamp-id], [class]')\n  ).filter((el) => {\n    const key = read(el);\n    return typeof key === 'string' && key.length > 0;\n  });\n  const root = nodes.find((el) => read(el) === 'root');\n  if (!root) return null;\n  const rootRect = root.getBoundingClientRect();\n  // The canvas renders inside a transformed frame. offsetWidth is the\n  // pre-transform layout width, so their ratio is the zoom factor; in a\n  // plain document it is 1.\n  const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;\n  const out = {};\n  for (const el of nodes) {\n    const key = read(el);\n    if (typeof key !== 'string') continue;\n    // Only Scamp's own classes; ignore app chrome and helper wrappers.\n    if (!/^[a-z][a-z0-9_]*([/][a-z][a-z0-9_]*)?$/i.test(key)) continue;\n    if (out[key]) continue;\n    const r = el.getBoundingClientRect();\n    out[key] = {\n      x: (r.left - rootRect.left) / scale,\n      y: (r.top - rootRect.top) / scale,\n      w: r.width / scale,\n      h: r.height / scale,\n    };\n  }\n  return out;\n})()";
export declare const measure: (page: Page) => Promise<Geometry>;
export declare const launchTruthBrowser: () => Promise<Browser>;
/**
 * Render a fixture's markup the way a browser would, and measure it.
 *
 * `viewport` must match the width the canvas root actually got, since
 * layout depends on it — a different width is a different (valid) layout,
 * not a divergence.
 */
export declare const measureInBrowser: (browser: Browser, source: {
    html: string;
    css: string;
    themeCss: string;
}, viewport: {
    width: number;
    height: number;
}) => Promise<Geometry>;
export type Divergence = {
    element: string;
    field: keyof Box;
    canvas: number;
    browser: number;
    delta: number;
};
/**
 * Compare two geometries. Sub-pixel differences are noise — anything at or
 * above `tolerance` is a real layout difference a user could see.
 */
export declare const compareGeometry: (canvas: Geometry, browser: Geometry, tolerance?: number) => Divergence[];
/** Human-readable failure text — the numbers are the whole point. */
export declare const describeDivergences: (divergences: ReadonlyArray<Divergence>) => string;
