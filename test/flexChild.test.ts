import { describe, it, expect } from 'vitest';

import { preserveDrawnSize, releaseDrawnSize } from '@lib/flexChild';
import { DEFAULT_RECT_STYLES } from '@lib/defaults';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';

const element = (over: Partial<ScampElement> = {}): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id: 'a1b2',
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  ...over,
});

const parentWith = (display: ScampElement['display']): ScampElement =>
  element({ id: 'parent', parentId: null, display });

describe('preserveDrawnSize', () => {
  it('opts a flex child out of shrinking', () => {
    // The bug: a drawn box reported its drawn width in CSS and rendered
    // narrower, because flex-shrink squashed it once the line overflowed.
    const result = preserveDrawnSize(element(), parentWith('flex'));
    expect(result.customProperties).toEqual({ 'flex-shrink': '0' });
  });

  it('leaves a grid child alone', () => {
    // A grid item is sized by its track and already honours an explicit
    // width, so the declaration would be noise in the output.
    expect(
      preserveDrawnSize(element(), parentWith('grid')).customProperties
    ).toEqual({});
  });

  it('leaves a child of a plain container alone', () => {
    expect(
      preserveDrawnSize(element(), parentWith('none')).customProperties
    ).toEqual({});
  });

  it('leaves the element alone when there is no parent', () => {
    expect(preserveDrawnSize(element(), undefined).customProperties).toEqual({});
  });

  it('returns the same object when it changes nothing', () => {
    // Identity matters: the store spreads these into state, and a fresh
    // object for a no-op is a needless re-render.
    const el = element();
    expect(preserveDrawnSize(el, parentWith('none'))).toBe(el);
  });

  it('keeps other custom properties', () => {
    const el = element({ customProperties: { cursor: 'pointer' } });
    expect(preserveDrawnSize(el, parentWith('flex')).customProperties).toEqual({
      cursor: 'pointer',
      'flex-shrink': '0',
    });
  });

  it('never overwrites an existing flex-shrink', () => {
    // Either the user set it or it came from the file; both outrank a
    // default applied at creation.
    const el = element({ customProperties: { 'flex-shrink': '1' } });
    expect(preserveDrawnSize(el, parentWith('flex')).customProperties).toEqual({
      'flex-shrink': '1',
    });
  });

  it('does not mutate the element it was given', () => {
    const el = element();
    preserveDrawnSize(el, parentWith('flex'));
    expect(el.customProperties).toEqual({});
  });

  it('leaves every other field untouched', () => {
    const el = element({ widthValue: 180, heightValue: 120 });
    const result = preserveDrawnSize(el, parentWith('flex'));
    expect(result.widthValue).toBe(180);
    expect(result.heightValue).toBe(120);
    expect(result.id).toBe(el.id);
  });
});

describe('releaseDrawnSize', () => {
  const drawn = (): ScampElement =>
    element({ customProperties: { 'flex-shrink': '0' } });

  it('drops the draw-time flex-shrink when the main axis leaves fixed', () => {
    // width: 100% with shrink 0 is basis-100% that cannot shrink — a
    // "fill width" main panel renders container-wide and overflows past
    // its fixed sibling by exactly the sibling's width.
    const patch = releaseDrawnSize(drawn(), parentWith('flex'), {
      widthMode: 'stretch',
    });
    expect(patch.customProperties).toEqual({});
    expect(patch.widthMode).toBe('stretch');
  });

  it('uses height as the main axis in a column parent', () => {
    const col = element({ id: 'col', parentId: null, display: 'flex', flexDirection: 'column' });
    expect(
      releaseDrawnSize(drawn(), col, { heightMode: 'stretch' }).customProperties
    ).toEqual({});
    // Width is the CROSS axis in a column — flex-shrink is irrelevant there.
    expect(
      releaseDrawnSize(drawn(), col, { widthMode: 'stretch' }).customProperties
    ).toBeUndefined();
  });

  it('leaves the cross axis alone in a row parent', () => {
    // flex-shrink has no effect on the cross axis; fill-height must not
    // strip the width preservation.
    expect(
      releaseDrawnSize(drawn(), parentWith('flex'), { heightMode: 'stretch' })
        .customProperties
    ).toBeUndefined();
  });

  it('leaves a fixed-to-fixed change alone', () => {
    expect(
      releaseDrawnSize(drawn(), parentWith('flex'), {
        widthMode: 'fixed',
        widthValue: 300,
      }).customProperties
    ).toBeUndefined();
  });

  it('never touches a flex-shrink the user authored with another value', () => {
    const el = element({ customProperties: { 'flex-shrink': '2' } });
    expect(
      releaseDrawnSize(el, parentWith('flex'), { widthMode: 'stretch' })
        .customProperties
    ).toBeUndefined();
  });

  it('keeps other custom properties when it strips the shrink', () => {
    const el = element({
      customProperties: { 'flex-shrink': '0', cursor: 'pointer' },
    });
    expect(
      releaseDrawnSize(el, parentWith('flex'), { widthMode: 'stretch' })
        .customProperties
    ).toEqual({ cursor: 'pointer' });
  });

  it('is a no-op outside a flex parent', () => {
    expect(
      releaseDrawnSize(drawn(), parentWith('none'), { widthMode: 'stretch' })
        .customProperties
    ).toBeUndefined();
    expect(
      releaseDrawnSize(drawn(), undefined, { widthMode: 'stretch' })
        .customProperties
    ).toBeUndefined();
  });
});
