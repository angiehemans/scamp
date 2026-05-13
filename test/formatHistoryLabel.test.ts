import { describe, it, expect } from 'vitest';
import {
  formatHistoryLabel,
  formatRelativeTime,
} from '@store/formatHistoryLabel';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import {
  ROOT_ELEMENT_ID,
  type ScampElement,
} from '@lib/element';
import type { HistoryEntry } from '@store/historyTypes';

const makeRect = (
  id: string,
  overrides: Partial<ScampElement> = {}
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...overrides,
});

const entry = (
  partial: Partial<HistoryEntry> & { kind: HistoryEntry['kind'] }
): HistoryEntry => ({
  id: 'e1',
  timestamp: 0,
  kind: partial.kind,
  elementIds: partial.elementIds ?? [],
  propertyKeys: partial.propertyKeys,
  previousName: partial.previousName,
  pageName: partial.pageName,
  snapshot: partial.snapshot ?? {},
});

describe('formatHistoryLabel — action kinds', () => {
  it('renders "Drew rectangle" for draw-rect', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(entry({ kind: 'draw-rect' }), elements)
    ).toBe('Drew rectangle');
  });

  it('renders "Added text" for add-text', () => {
    expect(
      formatHistoryLabel(entry({ kind: 'add-text' }), {})
    ).toBe('Added text');
  });

  it('renders "Deleted rect_a1b2"', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({ kind: 'delete', elementIds: ['a1b2'] }),
        elements
      )
    ).toBe('Deleted rect_a1b2');
  });

  it('renders "Moved rect_a1b2"', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({ kind: 'move', elementIds: ['a1b2'] }),
        elements
      )
    ).toBe('Moved rect_a1b2');
  });

  it('renders "Resized rect_a1b2"', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({ kind: 'resize', elementIds: ['a1b2'] }),
        elements
      )
    ).toBe('Resized rect_a1b2');
  });

  it('renders "Changed background — rect_a1b2" for a patch entry', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({
          kind: 'patch',
          elementIds: ['a1b2'],
          propertyKeys: ['backgroundColor'],
        }),
        elements
      )
    ).toBe('Changed background — rect_a1b2');
  });

  it('dedupes parallel property keys (width width)', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({
          kind: 'patch',
          elementIds: ['a1b2'],
          propertyKeys: ['widthMode', 'widthValue', 'widthCustom'],
        }),
        elements
      )
    ).toBe('Changed width — rect_a1b2');
  });

  it('joins distinct property keys with comma', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({
          kind: 'patch',
          elementIds: ['a1b2'],
          propertyKeys: ['x', 'y'],
        }),
        elements
      )
    ).toBe('Changed left, top — rect_a1b2');
  });

  it('falls back to "styles" when no property keys are given', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({ kind: 'patch', elementIds: ['a1b2'] }),
        elements
      )
    ).toBe('Changed styles — rect_a1b2');
  });

  it('renders "Edited styles — rect_a1b2" for raw-css', () => {
    const elements = { a1b2: makeRect('a1b2') };
    expect(
      formatHistoryLabel(
        entry({ kind: 'raw-css', elementIds: ['a1b2'] }),
        elements
      )
    ).toBe('Edited styles — rect_a1b2');
  });

  it('renders "Renamed old to new"', () => {
    const elements = { a1b2: makeRect('a1b2', { name: 'hero card' }) };
    expect(
      formatHistoryLabel(
        entry({
          kind: 'rename',
          elementIds: ['a1b2'],
          previousName: 'rect_a1b2',
        }),
        elements
      )
    ).toBe('Renamed rect_a1b2 to hero_card_a1b2');
  });

  it('renders "Added page home"', () => {
    expect(
      formatHistoryLabel(
        entry({ kind: 'add-page', pageName: 'home' }),
        {}
      )
    ).toBe('Added page home');
  });

  it('renders "Renamed page old to new"', () => {
    expect(
      formatHistoryLabel(
        entry({
          kind: 'rename-page',
          previousName: 'home',
          pageName: 'landing',
        }),
        {}
      )
    ).toBe('Renamed page home to landing');
  });

  it('renders "External edit detected"', () => {
    expect(
      formatHistoryLabel(entry({ kind: 'external-edit' }), {})
    ).toBe('External edit detected');
  });
});

describe('formatHistoryLabel — retroactive rename', () => {
  it('uses the CURRENT element name even on old entries', () => {
    // Entry was recorded when the element had no custom name (id-only label).
    const e = entry({
      kind: 'patch',
      elementIds: ['a1b2'],
      propertyKeys: ['backgroundColor'],
    });
    // User has since renamed the element.
    const elements = { a1b2: makeRect('a1b2', { name: 'hero card' }) };
    expect(formatHistoryLabel(e, elements)).toBe(
      'Changed background — hero_card_a1b2'
    );
  });

  it('renders [deleted] when the entry references an element no longer in the map', () => {
    const e = entry({
      kind: 'patch',
      elementIds: ['gone'],
      propertyKeys: ['backgroundColor'],
    });
    expect(formatHistoryLabel(e, {})).toBe('Changed background — [deleted]');
  });
});

describe('formatRelativeTime', () => {
  const now = 1_000_000_000;

  it('returns "just now" for very recent timestamps', () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 29_999, now)).toBe('just now');
  });

  it('returns "30 sec ago" for 30-59s', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('30 sec ago');
    expect(formatRelativeTime(now - 59_999, now)).toBe('30 sec ago');
  });

  it('returns "N min ago" for 1-59 minutes', () => {
    expect(formatRelativeTime(now - 60_000, now)).toBe('1 min ago');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
  });

  it('returns "N hr ago" for 1-23 hours', () => {
    expect(formatRelativeTime(now - 60 * 60_000, now)).toBe('1 hr ago');
    expect(formatRelativeTime(now - 5 * 60 * 60_000, now)).toBe('5 hr ago');
  });

  it('returns absolute HH:MM for ≥ 24h ago', () => {
    const out = formatRelativeTime(now - 25 * 60 * 60_000, now);
    expect(out).toMatch(/^\d\d:\d\d$/);
  });
});
