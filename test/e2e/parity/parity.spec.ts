import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
import { PARITY_FIXTURES, type ParityFixture } from './fixtures';
import {
  compareGeometry,
  describeDivergences,
  launchTruthBrowser,
  measure,
  measureInBrowser,
} from './harness';

/**
 * The canvas and the preview must lay out identically. This renders each
 * fixture both ways from the same source files and compares the geometry
 * of every element.
 *
 * Fixtures carrying `knownGap` are asserted to FAIL — they record a
 * divergence we know about and haven't fixed, so the suite stays green
 * while telling us the moment one is closed.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */

/** Layout differences below this are sub-pixel noise, not divergence. */
const TOLERANCE_PX = 1;

const runParityCheck = async (
  fixture: ParityFixture,
  window: Parameters<typeof measure>[0],
  themeCss: string
): Promise<void> => {
  await expect(pageRoot(window)).toBeVisible();

  const canvas = await measure(window);
  // Lay the browser out at the same width the canvas root actually got;
  // a different width is a different valid layout, not a divergence.
  const rootWidth = canvas['root']?.w;
  expect(rootWidth, 'canvas root has a measurable width').toBeGreaterThan(0);

  const browser = await launchTruthBrowser();
  try {
    const truth = await measureInBrowser(
      browser,
      { html: fixture.html, css: fixture.css, themeCss },
      { width: Math.round(rootWidth ?? 0), height: 900 }
    );
    const divergences = compareGeometry(canvas, truth, TOLERANCE_PX);
    expect(
      divergences,
      divergences.length === 0
        ? ''
        : `canvas and browser disagree for "${fixture.name}":\n${describeDivergences(divergences)}\n\n${fixture.why}`
    ).toEqual([]);
  } finally {
    await browser.close();
  }
};

/**
 * The TSX and the HTML are written by hand and must stay in step. Comparing
 * the element names they carry catches a fixture edited on one side only,
 * which would otherwise look like a canvas divergence.
 */
const elementNames = (source: string, attribute: string): string[] =>
  [...source.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))]
    .map((m) => m[1] ?? '')
    .sort();

test.describe('parity fixtures are internally consistent', () => {
  for (const fixture of PARITY_FIXTURES) {
    test(`${fixture.name}: tsx and html describe the same elements`, () => {
      expect(elementNames(fixture.html, 'class')).toEqual(
        elementNames(fixture.tsx, 'data-scamp-id')
      );
    });
  }
});

for (const fixture of PARITY_FIXTURES) {
  test.describe(`parity: ${fixture.name}`, () => {
    test.use({
      projectOptions: {
        pageContent: { home: { tsx: fixture.tsx, css: fixture.css } },
      },
    });

    test(`canvas matches the browser${fixture.knownGap ? ' (known gap)' : ''}`, async ({
      window,
      project,
    }) => {
      if (fixture.knownGap !== undefined) {
        // Documented divergence. `test.fail()` asserts it still fails, so
        // this flips to a failure when the gap closes and needs removing.
        test.fail(true, fixture.knownGap);
      }
      await runParityCheck(fixture, window, await project.readTheme());
    });
  });
}
