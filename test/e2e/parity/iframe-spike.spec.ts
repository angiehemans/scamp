import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
import { PARITY_FIXTURES } from './fixtures';
import {
  compareGeometry,
  describeDivergences,
  launchTruthBrowser,
  measureInBrowser,
  type Geometry,
} from './harness';

/**
 * Phase A of the iframe migration, as a spike rather than a flag.
 *
 * The question is not whether an iframe has its own viewport — that was
 * measured already. It is whether a document rendered inside one, in
 * Electron, with the project's theme and fonts, matches what a plain
 * browser produces from the same source. Fonts, custom properties, device
 * pixel ratio and the generated CSS in a fresh document are all things the
 * earlier probe could not answer.
 *
 * Nothing here touches production code. If the numbers are good the
 * migration is worth committing to; if they are not, this file is deleted
 * and we have lost a day rather than a month.
 *
 * see docs/plans/canvas-iframe-plan.md
 */

/**
 * Build the document, measure it and tear it down in ONE evaluate.
 *
 * A real function rather than a source string: Playwright only forwards
 * the argument to the function form, and the string form silently got
 * `undefined` — which looked exactly like the iframe failing to render.
 *
 * Split across two evaluates it also failed, the iframe having vanished
 * by the second call. One call has no window for that to happen in.
 */
const renderAndMeasure = async (
  html: string,
  css: string,
  themeCss: string,
  width: number
): Promise<Geometry | null> =>
  (await windowRef!.evaluate(
    async ([htmlIn, cssIn, themeIn, widthIn]) => {
      const tick = (): Promise<void> =>
        new Promise((r) => setTimeout(r, 60));
      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'position:fixed;left:0;top:0;z-index:99999;border:0;background:#fff;' +
        `width:${widthIn}px;height:900px;`;
      document.body.appendChild(iframe);
      // A freshly appended iframe's about:blank document is replaced
      // shortly after; writing into it synchronously loses the content.
      await tick();
      try {
        const doc = iframe.contentDocument;
        if (!doc) return null;
        doc.open();
        doc.write(
          '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
            `<style>${themeIn}</style><style>${cssIn}</style>` +
            `</head><body style="margin:0;min-height:100vh">${htmlIn}</body></html>`
        );
        doc.close();
        await tick();
        const nodes = Array.from(doc.querySelectorAll('[class]'));
        const root = nodes.find((el) => el.className === 'root');
        if (!root) return null;
        const rootRect = root.getBoundingClientRect();
        const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
        for (const el of nodes) {
          const key = el.className;
          if (typeof key !== 'string' || !/^[a-z][a-z0-9_]*$/i.test(key)) continue;
          if (out[key]) continue;
          const r = el.getBoundingClientRect();
          out[key] = {
            x: r.left - rootRect.left,
            y: r.top - rootRect.top,
            w: r.width,
            h: r.height,
          };
        }
        return out;
      } finally {
        iframe.remove();
      }
    },
    [html, css, themeCss, width] as const
  )) as Geometry | null;

/** Set per test so the helper above can reach the app window. */
let windowRef: import('@playwright/test').Page | null = null;

const ARTBOARD_WIDTH = 1440;

test.describe('iframe spike: does an in-app iframe match a plain browser', () => {
  for (const fixture of PARITY_FIXTURES.filter((f) => !f.components)) {
    test(`${fixture.name}`, async ({ window, project }) => {
      windowRef = window;
      await expect(pageRoot(window)).toBeVisible();
      const themeCss = await project.readTheme();
      const css = `${fixture.css}\n${fixture.truthCss ?? ''}`;

      const inIframe = await renderAndMeasure(
        fixture.html,
        css,
        themeCss,
        ARTBOARD_WIDTH
      );
      expect(inIframe, 'the spike iframe rendered a root').not.toBeNull();

      const browser = await launchTruthBrowser();
      try {
        const truth = await measureInBrowser(
          browser,
          { html: fixture.html, css, themeCss },
          { width: ARTBOARD_WIDTH, height: 900 }
        );
        const divergences = compareGeometry(inIframe ?? {}, truth, 1);
        expect(
          divergences,
          divergences.length === 0
            ? ''
            : `iframe and browser disagree for "${fixture.name}":\n${describeDivergences(divergences)}`
        ).toEqual([]);

      } finally {
        await browser.close();
      }
    });
  }

  test('a media query follows the artboard width, which is the whole point', async ({
    window,
    project,
  }) => {
    // Impossible on today's canvas: the rules the injected stylesheet had
    // to strip, because a div cannot be a viewport.
    windowRef = window;
    await expect(pageRoot(window)).toBeVisible();
    const css = `.root { width: 100%; min-height: 100vh; position: relative; }
.box_m001 { width: 300px; height: 100px; background: #334455; }
@media (max-width: 500px) {
  .box_m001 { width: 120px; }
}
`;
    const html = `<div class="root"><div class="box_m001"></div></div>`;
    const themeCss = await project.readTheme();

    const widthAt = async (artboard: number): Promise<number> => {
      const g = await renderAndMeasure(html, css, themeCss, artboard);
      return g?.['box_m001']?.w ?? -1;
    };

    expect(await widthAt(1440), 'desktop artboard uses the base rule').toBe(300);
    expect(await widthAt(390), 'mobile artboard applies the media query').toBe(
      120
    );
  });
});
