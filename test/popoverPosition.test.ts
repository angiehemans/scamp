import { describe, it, expect } from 'vitest';

import { computePopoverPosition } from '@lib/popoverPosition';

/** Minimal DOMRect for the fields computePopoverPosition reads. */
const rect = (o: Partial<DOMRect>): DOMRect =>
  ({
    x: 0,
    y: 0,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...o,
  }) as DOMRect;

const VIEWPORT = { width: 1000, height: 800 };

describe('computePopoverPosition', () => {
  it('places the popover below the trigger by default', () => {
    const pos = computePopoverPosition(
      rect({ top: 100, bottom: 120, left: 50, right: 150, width: 100 }),
      { width: 200, desiredMaxHeight: 300, align: 'left' },
      VIEWPORT
    );
    expect(pos.placedAbove).toBe(false);
    expect(pos.top).toBe(124); // trigger.bottom + gap(4)
    expect(pos.bottom).toBeUndefined();
    expect(pos.left).toBe(50);
  });

  it('clamps maxHeight to the available space below', () => {
    const pos = computePopoverPosition(
      rect({ top: 600, bottom: 620 }),
      { width: 200, desiredMaxHeight: 400, align: 'left' },
      VIEWPORT
    );
    // spaceBelow = 800 - 620 - edgeMargin(8) - gap(4) = 168
    expect(pos.placedAbove).toBe(false);
    expect(pos.maxHeight).toBe(168);
  });

  it('flips above when there is not enough room below', () => {
    const pos = computePopoverPosition(
      rect({ top: 700, bottom: 720, left: 50, right: 150, width: 100 }),
      { width: 200, desiredMaxHeight: 300, align: 'left' },
      VIEWPORT
    );
    // spaceBelow = 800 - 720 - 12 = 68 < minFitBelow(120); above wins.
    expect(pos.placedAbove).toBe(true);
    expect(pos.bottom).toBe(104); // viewport.height - trigger.top + gap
    expect(pos.top).toBeUndefined();
  });

  it('measures space above from the title-bar inset, shrinking maxHeight', () => {
    const opts = {
      width: 200,
      desiredMaxHeight: 400,
      align: 'left' as const,
      minFitBelow: 200,
    };
    const trigger = rect({ top: 300, bottom: 320 });

    const withInset = computePopoverPosition(trigger, opts, {
      width: 1000,
      height: 500,
      top: 36,
    });
    // spaceAbove = 300 - gap(4) - (inset 36 + edgeMargin 8) = 252
    expect(withInset.placedAbove).toBe(true);
    expect(withInset.maxHeight).toBe(252);

    const withoutInset = computePopoverPosition(trigger, opts, {
      width: 1000,
      height: 500,
    });
    // spaceAbove = 300 - 4 - 8 = 288 (no title bar reserved)
    expect(withoutInset.maxHeight).toBe(288);
  });

  it('keeps the popover within the left/right viewport edges', () => {
    const pos = computePopoverPosition(
      rect({ top: 100, bottom: 120, left: 950, right: 990, width: 40 }),
      { width: 200, desiredMaxHeight: 300, align: 'left' },
      VIEWPORT
    );
    // left starts at 950 but 950 + 200 > 1000 - 8 → clamp to 792.
    expect(pos.left).toBe(792);
  });

  it('overlays centered on the trigger when neither side fits and overlayWhenTight is set', () => {
    const trigger = rect({ top: 300, bottom: 320, height: 20 });
    const opts = {
      width: 200,
      desiredMaxHeight: 420,
      align: 'left' as const,
      minFitBelow: 420,
      overlayWhenTight: true,
    };
    // Window 600 tall, 36px title bar: spaceBelow=268, spaceAbove=252 —
    // neither >= 420, so it overlays centered on the trigger center (310).
    const pos = computePopoverPosition(trigger, opts, {
      width: 1000,
      height: 600,
      top: 36,
    });
    expect(pos.placedAbove).toBe(false);
    expect(pos.bottom).toBeUndefined();
    expect(pos.maxHeight).toBe(420); // full desired height via the whole window
    expect(pos.top).toBe(100); // triggerCenter(310) - maxHeight/2(210)
  });

  it('does not overlay when a side fits, even with overlayWhenTight', () => {
    // Tall window: below has ample room, so it docks below as usual.
    const pos = computePopoverPosition(
      rect({ top: 100, bottom: 120, height: 20 }),
      {
        width: 200,
        desiredMaxHeight: 420,
        align: 'left',
        minFitBelow: 420,
        overlayWhenTight: true,
      },
      { width: 1000, height: 900, top: 36 }
    );
    expect(pos.placedAbove).toBe(false);
    expect(pos.top).toBe(124); // docked below, not overlaid
  });

  it('aligns the popover to the trigger right edge when align=right', () => {
    const pos = computePopoverPosition(
      rect({ top: 100, bottom: 120, left: 300, right: 400, width: 100 }),
      { width: 200, desiredMaxHeight: 300, align: 'right' },
      VIEWPORT
    );
    expect(pos.left).toBe(200); // trigger.right(400) - width(200)
  });
});
