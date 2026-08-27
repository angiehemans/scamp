import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chromium, type Browser, type Page } from '@playwright/test';

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

export type Box = { x: number; y: number; w: number; h: number };
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
export const MEASURE_SCRIPT = `(() => {
  // Inside a component instance the element names are the COMPONENT's, so
  // a page root and a component root are both "root". Qualify by the
  // owning instance so the two don't collide — and so both sides key the
  // same way, since the browser document marks instances the same way.
  const instanceOf = (el) => {
    const host = el.closest('[data-scamp-instance-id]');
    return host ? host.getAttribute('data-scamp-instance-id') : null;
  };
  const read = (el) => {
    const own = el.getAttribute('data-scamp-id') || el.className;
    if (typeof own !== 'string') return own;
    const inst = instanceOf(el);
    return inst ? inst + '/' + own : own;
  };
  const nodes = Array.from(
    document.querySelectorAll('[data-scamp-id], [class]')
  ).filter((el) => {
    const key = read(el);
    return typeof key === 'string' && key.length > 0;
  });
  const root = nodes.find((el) => read(el) === 'root');
  if (!root) return null;
  const rootRect = root.getBoundingClientRect();
  // The canvas renders inside a transformed frame. offsetWidth is the
  // pre-transform layout width, so their ratio is the zoom factor; in a
  // plain document it is 1.
  const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
  const out = {};
  for (const el of nodes) {
    const key = read(el);
    if (typeof key !== 'string') continue;
    // Only Scamp's own classes; ignore app chrome and helper wrappers.
    if (!/^[a-z][a-z0-9_]*([/][a-z][a-z0-9_]*)?$/i.test(key)) continue;
    if (out[key]) continue;
    const r = el.getBoundingClientRect();
    out[key] = {
      x: (r.left - rootRect.left) / scale,
      y: (r.top - rootRect.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  }
  return out;
})()`;

export const measure = async (page: Page): Promise<Geometry> => {
  const result = (await page.evaluate(MEASURE_SCRIPT)) as Geometry | null;
  if (result === null) throw new Error('no root element found to measure from');
  return result;
};

/**
 * Playwright's bundled Chromium may not be installed (this repo's e2e
 * suite drives Electron, so browsers aren't a hard dependency). Fall back
 * to any Chromium build already in the Playwright cache before giving up,
 * so the harness runs locally without an extra install step.
 */
const findChromium = async (): Promise<string | undefined> => {
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  let entries: string[];
  try {
    entries = await fs.readdir(cache);
  } catch {
    return undefined;
  }
  const builds = entries
    .filter((e) => e.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1] ?? 0) - Number(a.split('-')[1] ?? 0));
  for (const build of builds) {
    const candidate = path.join(cache, build, 'chrome-linux64', 'chrome');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try the next build
    }
  }
  return undefined;
};

export const launchTruthBrowser = async (): Promise<Browser> => {
  try {
    return await chromium.launch();
  } catch {
    const executablePath = await findChromium();
    if (executablePath === undefined) {
      throw new Error(
        'No Chromium available for the parity harness. Run `npx playwright install chromium`.'
      );
    }
    return chromium.launch({ executablePath });
  }
};

/**
 * Render a fixture's markup the way a browser would, and measure it.
 *
 * `viewport` must match the width the canvas root actually got, since
 * layout depends on it — a different width is a different (valid) layout,
 * not a divergence.
 */
export const measureInBrowser = async (
  browser: Browser,
  source: { html: string; css: string; themeCss: string },
  viewport: { width: number; height: number }
): Promise<Geometry> => {
  // Mirrors app/layout.tsx: it imports `theme.css` before the page's own
  // module and wraps everything in `<body style="margin: 0; min-height:
  // 100vh">`. The theme carries the `box-sizing: border-box` reset and the
  // block-margin reset — omitting it makes the browser side disagree with
  // the canvas over padding and `<p>` margins for reasons that have nothing
  // to do with the canvas.
  const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
${source.themeCss}
    </style>
    <style>
${source.css}
    </style>
  </head>
  <body style="margin: 0; min-height: 100vh">
${source.html}
  </body>
</html>`;
  const page = await browser.newPage({ viewport });
  try {
    await page.setContent(document, { waitUntil: 'load' });
    return await measure(page);
  } finally {
    await page.close();
  }
};

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
export const compareGeometry = (
  canvas: Geometry,
  browser: Geometry,
  tolerance = 1
): Divergence[] => {
  const out: Divergence[] = [];
  for (const [element, browserBox] of Object.entries(browser)) {
    const canvasBox = canvas[element];
    if (canvasBox === undefined) {
      out.push({
        element,
        field: 'x',
        canvas: Number.NaN,
        browser: browserBox.x,
        delta: Number.POSITIVE_INFINITY,
      });
      continue;
    }
    for (const field of ['x', 'y', 'w', 'h'] as const) {
      const delta = Math.abs(canvasBox[field] - browserBox[field]);
      if (delta >= tolerance) {
        out.push({
          element,
          field,
          canvas: canvasBox[field],
          browser: browserBox[field],
          delta,
        });
      }
    }
  }
  return out;
};

/** Human-readable failure text — the numbers are the whole point. */
export const describeDivergences = (
  divergences: ReadonlyArray<Divergence>
): string =>
  divergences
    .map((d) =>
      Number.isNaN(d.canvas)
        ? `  ${d.element}: missing from the canvas entirely`
        : `  ${d.element}.${d.field}: canvas ${d.canvas.toFixed(1)} vs browser ${d.browser.toFixed(1)} (off by ${d.delta.toFixed(1)}px)`
    )
    .join('\n');
