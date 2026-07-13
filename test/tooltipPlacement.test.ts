import { describe, expect, it } from 'vitest';
import {
  resolveTooltipPlacement,
  TOOLTIP_GAP,
} from '../src/renderer/lib/tooltipPlacement';

describe('resolveTooltipPlacement', () => {
  it('stays on top when there is room above the trigger', () => {
    expect(resolveTooltipPlacement(200, 40)).toBe('top');
  });

  it('flips to bottom when the trigger is too near the top edge', () => {
    // Trigger 8px from the top can't fit a 40px bubble + gap above.
    expect(resolveTooltipPlacement(8, 40)).toBe('bottom');
  });

  it('uses the gap in the room check at the boundary', () => {
    const tipHeight = 40;
    // Exactly tipHeight + gap of room is just enough — stays on top.
    expect(
      resolveTooltipPlacement(tipHeight + TOOLTIP_GAP, tipHeight)
    ).toBe('top');
    // One pixel short of the needed room flips to bottom.
    expect(
      resolveTooltipPlacement(tipHeight + TOOLTIP_GAP - 1, tipHeight)
    ).toBe('bottom');
  });

  it('respects a forced top placement even with no room above', () => {
    expect(resolveTooltipPlacement(0, 40, 'top')).toBe('top');
  });

  it('respects a forced bottom placement even with room above', () => {
    expect(resolveTooltipPlacement(500, 40, 'bottom')).toBe('bottom');
  });

  it('honours a custom gap', () => {
    expect(resolveTooltipPlacement(45, 40, 'auto', 4)).toBe('top');
    expect(resolveTooltipPlacement(45, 40, 'auto', 20)).toBe('bottom');
  });
});
