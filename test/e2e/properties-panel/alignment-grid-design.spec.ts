import type { Locator } from '@playwright/test';

import { test, expect } from '../fixtures/app';
import { drawAndSelectRect, panelSection } from '../fixtures/panel';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';

/**
 * The preview matches the designed states (scamp-ui → alignment-grid page).
 *
 * The structural claim is that bars render inside the cell they describe, so
 * "aligned with the dots" is a consequence of the cell centring them rather
 * than something to tune. These assertions pin that: bar sizes, which cell
 * holds them, that its dot is hidden, and that the group is centred in it.
 */

/** Subpixel layout rounding only. */
const TOLERANCE = 0.6;

type Box = { x: number; y: number; width: number; height: number };

const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no bounding box');
  return box;
};

const centre = (b: Box): { x: number; y: number } => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

test.describe('alignment grid: matches the design', () => {
  const setUp = async (
    window: Parameters<typeof pageRoot>[0],
    mode: 'Flex row' | 'Flex column'
  ): Promise<void> => {
    await expect(pageRoot(window)).toBeVisible();
    await drawAndSelectRect(window, { x: 100, y: 100 }, { x: 300, y: 220 });
    await waitForSaved(window);
    await panelSection(window, 'Layout').getByRole('radio', { name: mode }).click();
    await waitForSaved(window);
  };

  const layout = (window: Parameters<typeof pageRoot>[0]) =>
    panelSection(window, 'Layout');
  const bars = (window: Parameters<typeof pageRoot>[0]): Locator =>
    layout(window).locator('[data-align-bar]');
  const dots = (window: Parameters<typeof pageRoot>[0]): Locator =>
    layout(window).locator('[data-align-dot]');
  const cell = (window: Parameters<typeof pageRoot>[0], label: string): Locator =>
    layout(window).getByRole('button', { name: label });

  test('row: three bars at the designed sizes, in the chosen cell', async ({
    window,
  }) => {
    await setUp(window, 'Flex row');
    await cell(window, 'Align top left').click();

    await expect(bars(window)).toHaveCount(3);
    // 3×10, 3×14, 3×8 — straight from the design.
    const sizes = await Promise.all(
      [0, 1, 2].map(async (i) => {
        const b = await boxOf(bars(window).nth(i));
        return `${Math.round(b.width)}x${Math.round(b.height)}`;
      })
    );
    expect(sizes).toEqual(['3x10', '3x14', '3x8']);
  });

  test('row: the bar group is centred in its cell, for every cell', async ({
    window,
  }) => {
    // The property the old overlay had to hand-tune. Now it's free.
    await setUp(window, 'Flex row');

    for (const label of [
      'Align top left',
      'Align top center',
      'Align top right',
      'Align middle left',
      'Align middle center',
      'Align middle right',
      'Align bottom left',
      'Align bottom center',
      'Align bottom right',
    ]) {
      await cell(window, label).click();
      const group = await boxOf(layout(window).locator('[data-align-bar]').first());
      const last = await boxOf(layout(window).locator('[data-align-bar]').last());
      const groupCentreX = (group.x + last.x + last.width) / 2;
      const cellBox = await boxOf(cell(window, label));
      expect(
        Math.abs(groupCentreX - centre(cellBox).x),
        `${label}: bar group centred horizontally in its cell`
      ).toBeLessThan(TOLERANCE);
    }
  });

  test('row: the occupied cell hides its dot; the other eight remain', async ({
    window,
  }) => {
    await setUp(window, 'Flex row');
    await cell(window, 'Align middle center').click();

    await expect(dots(window)).toHaveCount(8);
    await expect(
      layout(window).locator('[data-align-dot="1-1"]')
    ).toHaveCount(0);
  });

  test('row: align start/center/end moves the bars within the band', async ({
    window,
  }) => {
    // Bars have different heights, so the alignment shows as which edge
    // they share.
    await setUp(window, 'Flex row');

    await cell(window, 'Align top left').click();
    let tall = await boxOf(bars(window).nth(1));
    let short = await boxOf(bars(window).nth(2));
    expect(Math.abs(tall.y - short.y), 'start: tops share an edge').toBeLessThan(
      TOLERANCE
    );

    await cell(window, 'Align middle left').click();
    tall = await boxOf(bars(window).nth(1));
    short = await boxOf(bars(window).nth(2));
    expect(
      Math.abs(centre(tall).y - centre(short).y),
      'center: centres share a line'
    ).toBeLessThan(TOLERANCE);

    await cell(window, 'Align bottom left').click();
    tall = await boxOf(bars(window).nth(1));
    short = await boxOf(bars(window).nth(2));
    expect(
      Math.abs(tall.y + tall.height - (short.y + short.height)),
      'end: bottoms share an edge'
    ).toBeLessThan(TOLERANCE);
  });

  test('row: space-between spreads one bar per column', async ({ window }) => {
    await setUp(window, 'Flex row');
    await cell(window, 'Align top left').click();
    // Double-clicking the control is the space-between shortcut.
    await layout(window).locator('[aria-label="Alignment"]').dblclick();

    await expect(bars(window)).toHaveCount(3);
    await expect(dots(window)).toHaveCount(6);

    // One bar centred in each of the three top-row cells.
    for (const [i, label] of [
      'Align top left',
      'Align top center',
      'Align top right',
    ].entries()) {
      const bar = await boxOf(bars(window).nth(i));
      const cellBox = await boxOf(cell(window, label));
      expect(
        Math.abs(centre(bar).x - centre(cellBox).x),
        `${label}: bar centred in its cell`
      ).toBeLessThan(TOLERANCE);
    }
  });

  test('column: bars turn horizontal and stack, at the designed sizes', async ({
    window,
  }) => {
    await setUp(window, 'Flex column');
    await cell(window, 'Align top left').click();

    await expect(bars(window)).toHaveCount(3);
    const sizes = await Promise.all(
      [0, 1, 2].map(async (i) => {
        const b = await boxOf(bars(window).nth(i));
        return `${Math.round(b.width)}x${Math.round(b.height)}`;
      })
    );
    expect(sizes).toEqual(['10x3', '14x3', '8x3']);
  });

  test('column: the bar group is centred in its cell', async ({ window }) => {
    await setUp(window, 'Flex column');

    for (const label of [
      'Align top left',
      'Align middle center',
      'Align bottom right',
    ]) {
      await cell(window, label).click();
      const first = await boxOf(bars(window).first());
      const last = await boxOf(bars(window).last());
      const groupCentreY = (first.y + last.y + last.height) / 2;
      const cellBox = await boxOf(cell(window, label));
      expect(
        Math.abs(groupCentreY - centre(cellBox).y),
        `${label}: bar group centred vertically in its cell`
      ).toBeLessThan(TOLERANCE);
    }
  });
});
