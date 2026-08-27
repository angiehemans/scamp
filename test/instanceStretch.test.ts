import { describe, expect, it } from 'vitest';

import { instanceStretchStyle } from '@lib/instanceStretch';

describe('instanceStretchStyle', () => {
  describe('non-stretch roots', () => {
    it('returns an empty style object when neither axis stretches', () => {
      expect(instanceStretchStyle('auto', 'auto', 'fit-content', 'auto', 'flex', 'row')).toEqual({});
    });

    it('returns an empty style object when the root modes are unknown', () => {
      expect(instanceStretchStyle('auto', 'auto', undefined, undefined, 'flex', 'row')).toEqual({});
    });

    it('returns an empty style object for a fixed-size root', () => {
      expect(instanceStretchStyle('auto', 'auto', 'fixed', 'fixed', undefined, undefined)).toEqual({});
    });
  });

  describe('outside a flex parent', () => {
    it('maps width stretch to width: 100% when the parent has no display', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'auto', undefined, undefined)).toEqual({
        width: '100%',
      });
    });

    it('maps height stretch to height: 100% in a grid parent', () => {
      expect(instanceStretchStyle('auto', 'auto', 'auto', 'stretch', 'grid', undefined)).toEqual({
        height: '100%',
      });
    });

    it('maps both axes when both stretch in a non-flex parent', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'stretch', 'none', undefined)).toEqual({
        width: '100%',
        height: '100%',
      });
    });
  });

  describe('in a flex row parent', () => {
    it('maps main-axis width stretch to width: 100% with a zero min-width', () => {
      // Mirrors `elementToStyle`: the generated CSS says `100%`, and `flex: 1`
      // would be basis 0 — a different layout as soon as there's a sized
      // sibling. see docs/notes/canvas-flex-main-axis-stretch.md
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'auto', 'flex', 'row')).toEqual({
        width: '100%',
        minWidth: 0,
      });
    });

    it('treats an absent direction as row, since row is the flex default', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'auto', 'flex', undefined)).toEqual({
        width: '100%',
        minWidth: 0,
      });
    });

    it('maps cross-axis height stretch to align-self rather than height: 100%', () => {
      expect(instanceStretchStyle('auto', 'auto', 'auto', 'stretch', 'flex', 'row')).toEqual({
        alignSelf: 'stretch',
      });
    });

    it('combines main-axis width with cross-axis align-self when both stretch', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'stretch', 'flex', 'row')).toEqual({
        width: '100%',
        minWidth: 0,
        alignSelf: 'stretch',
      });
    });
  });

  describe('an instance the page has sized', () => {
    it('does not inherit root stretch on an axis the instance fixes', () => {
      expect(
        instanceStretchStyle('fixed', 'auto', 'stretch', 'auto', 'flex', 'row')
      ).toEqual({});
    });

    it('does not inherit root stretch on an axis the instance hugs', () => {
      expect(
        instanceStretchStyle('fit-content', 'auto', 'stretch', 'auto', 'flex', 'row')
      ).toEqual({});
    });

    it('does not inherit root stretch on an axis the instance stretches itself', () => {
      // `elementToStyle` already emits the flex translation for the
      // instance's own stretch — re-adding it here would double up.
      expect(
        instanceStretchStyle('stretch', 'auto', 'stretch', 'auto', 'flex', 'row')
      ).toEqual({});
    });

    it('still inherits on the axis the instance leaves auto', () => {
      expect(
        instanceStretchStyle('fixed', 'auto', 'stretch', 'stretch', 'flex', 'row')
      ).toEqual({ alignSelf: 'stretch' });
    });
  });

  describe('in a flex column parent', () => {
    it('maps main-axis height stretch to height: 100% with a zero min-height', () => {
      expect(instanceStretchStyle('auto', 'auto', 'auto', 'stretch', 'flex', 'column')).toEqual({
        height: '100%',
        minHeight: 0,
      });
    });

    it('keeps width: 100% for cross-axis width stretch so align-items still applies', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'auto', 'flex', 'column')).toEqual({
        width: '100%',
      });
    });

    it('combines a main-axis height with a cross-axis width when both stretch', () => {
      expect(instanceStretchStyle('auto', 'auto', 'stretch', 'stretch', 'flex', 'column')).toEqual({
        height: '100%',
        minHeight: 0,
        width: '100%',
      });
    });
  });
});
