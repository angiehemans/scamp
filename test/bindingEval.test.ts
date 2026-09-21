import { describe, it, expect } from 'vitest';

import {
  EMPTY_SCOPE,
  childBindingKey,
  expandChildren,
  isShown,
  resolveAttr,
  resolveInstanceOverrides,
  resolveRef,
  resolveText,
  rowsFor,
  type BindingScope,
} from '@lib/bindingEval';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import type { ScampElement } from '@lib/element';

const el = (id: string, extra: Partial<ScampElement> = {}): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId: 'root',
  childIds: [],
  x: 0,
  y: 0,
  widthMode: 'auto',
  heightMode: 'auto',
  customProperties: {},
  inlineFragments: [],
  ...extra,
});

const scope: BindingScope = {
  samples: {
    players: [
      { id: '1', label: 'Alex', score: 3 },
      { id: '2', label: 'Bea', score: 12 },
    ],
    waiting: true,
    done: false,
  },
  row: { as: 'player', data: { id: '2', label: 'Bea', score: 12 }, index: 1 },
};

describe('resolveRef', () => {
  it('reads a root sample, a row field, an array length, and an inverted flag', () => {
    expect(resolveRef('waiting', scope)).toBe(true);
    expect(resolveRef('player.label', scope)).toBe('Bea');
    expect(resolveRef('player.score', scope)).toBe(12);
    expect(resolveRef('players.length', scope)).toBe(2);
    expect(resolveRef('!done', scope)).toBe(true);
    expect(resolveRef('!waiting', scope)).toBe(false);
  });

  it('resolves an unknown name or a bad path to undefined', () => {
    expect(resolveRef('nope', scope)).toBeUndefined();
    expect(resolveRef('player.missing', scope)).toBeUndefined();
    expect(resolveRef('waiting.x', scope)).toBeUndefined();
    expect(resolveRef('', scope)).toBeUndefined();
  });

  it('reads the row only under its own variable name', () => {
    expect(resolveRef('item.label', scope)).toBeUndefined();
  });
});

describe('resolveText / isShown / rowsFor', () => {
  it('resolves a row-bound text and leaves plain text alone', () => {
    expect(resolveText(el('t', { type: 'text', prop: 'player.label' }), scope)).toBe('Bea');
    expect(resolveText(el('t', { type: 'text', prop: 'player.score' }), scope)).toBe('12');
    expect(resolveText(el('t', { type: 'text', prop: 'player.missing' }), scope)).toBe('');
    expect(resolveText(el('t', { type: 'text', prop: 'code', text: 'KZQ4' }), scope)).toBeUndefined();
    expect(resolveText(el('t', { type: 'text', text: 'plain' }), scope)).toBeUndefined();
  });

  it('shows by flag, treats a missing flag as shown, and honours inversion', () => {
    expect(isShown(el('a'), scope)).toBe(true);
    expect(isShown(el('a', { showIf: 'waiting' }), scope)).toBe(true);
    expect(isShown(el('a', { showIf: 'done' }), scope)).toBe(false);
    expect(isShown(el('a', { showIf: '!done' }), scope)).toBe(true);
    expect(isShown(el('a', { showIf: 'unknown' }), scope)).toBe(true);
    expect(isShown(el('a', { showIf: '!unknown' }), scope)).toBe(false);
  });

  it('returns the rows for a repeat, or none', () => {
    expect(rowsFor(el('r', { repeat: { over: 'players', as: 'p' } }), scope)).toHaveLength(2);
    expect(rowsFor(el('r', { repeat: { over: 'missing', as: 'p' } }), scope)).toEqual([]);
    expect(rowsFor(el('r'), scope)).toEqual([]);
  });
});

describe('resolveInstanceOverrides', () => {
  it('keeps literal overrides and resolves row-bound props', () => {
    const inst = el('i', {
      type: 'component-instance',
      componentName: 'Card',
      instanceId: 'inst_i',
      propOverrides: { title: 'Pricing' },
      bind: { label: 'player.label', joined: 'joinedLabel' },
    });
    expect(resolveInstanceOverrides(inst, scope)).toEqual({ title: 'Pricing', label: 'Bea' });
  });
});

describe('resolveAttr', () => {
  it('resolves a row-bound image src and alt against the current row', () => {
    const img = el('i', {
      type: 'image',
      src: '',
      alt: '',
      bind: { src: 'player.avatar', alt: 'player.label' },
    });
    const withAvatar: BindingScope = {
      ...scope,
      row: { as: 'player', data: { id: '2', label: 'Bea', avatar: '/a/bea.png' }, index: 1 },
    };
    expect(resolveAttr(img, 'src', withAvatar)).toBe('/a/bea.png');
    expect(resolveAttr(img, 'alt', withAvatar)).toBe('Bea');
  });

  it('returns undefined for an unbound attribute, so the sample on the element wins', () => {
    const img = el('i', { type: 'image', src: '/a/fallback.png', alt: 'Fallback' });
    expect(resolveAttr(img, 'src', scope)).toBeUndefined();
  });

  it('returns undefined for a prop binding, whose sample is already on the element', () => {
    const img = el('i', { type: 'image', src: '/a/sample.png', bind: { src: 'photo' } });
    expect(resolveAttr(img, 'src', scope)).toBeUndefined();
  });

  it('resolves a row field the row does not carry to an empty string, not the marker', () => {
    const img = el('i', { type: 'image', src: '', bind: { src: 'player.missing' } });
    expect(resolveAttr(img, 'src', scope)).toBe('');
  });
});

describe('expandChildren', () => {
  const elements: Record<string, ScampElement> = {
    root: el('root', { parentId: null, childIds: ['a', 'list', 'hidden', 'shown'] }),
    a: el('a'),
    list: el('list', { repeat: { over: 'players', as: 'player' } }),
    hidden: el('hidden', { showIf: 'done' }),
    shown: el('shown', { showIf: 'waiting' }),
  };

  it('drops hidden children, repeats per row with the row in scope, and passes the row down otherwise', () => {
    const rootScope: BindingScope = { samples: scope.samples, row: null };
    const out = expandChildren(elements, elements['root']!.childIds, rootScope);
    expect(out.map((o) => [o.id, o.row?.index ?? null, o.row?.data['label'] ?? null])).toEqual([
      ['a', null, null],
      ['list', 0, 'Alex'],
      ['list', 1, 'Bea'],
      ['shown', null, null],
    ]);
    const nested = expandChildren(elements, ['a'], scope);
    expect(nested[0]?.row?.as).toBe('player');
  });

  it('renders nothing for a repeat with no rows and skips unknown ids', () => {
    expect(expandChildren(elements, ['list', 'ghost'], EMPTY_SCOPE)).toEqual([]);
  });
});

describe('childBindingKey', () => {
  it('changes when a child gains or loses a binding', () => {
    const before = childBindingKey({ a: el('a'), b: el('b') }, ['a', 'b']);
    const after = childBindingKey({ a: el('a', { showIf: 'x' }), b: el('b') }, ['a', 'b']);
    expect(before).not.toBe(after);
    expect(childBindingKey({ a: el('a') }, ['a', 'missing'])).toBe('a:::|missing');
  });
});
