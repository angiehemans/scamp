import { describe, expect, it } from 'vitest';

import { splitTooltipLabel } from '../src/renderer/lib/tooltipLabel';

describe('splitTooltipLabel', () => {
  describe('labels following the "Name — description" convention', () => {
    it('splits a field name from its description', () => {
      expect(
        splitTooltipLabel(
          'Height — type a number, or any CSS length (100vh, calc(...)). Set the unit on the right.'
        )
      ).toEqual({
        header: 'Height',
        body: 'type a number, or any CSS length (100vh, calc(...)). Set the unit on the right.',
      });
    });

    it('splits a multi-word header', () => {
      expect(
        splitTooltipLabel('Lock aspect ratio — width and height scale together')
      ).toEqual({
        header: 'Lock aspect ratio',
        body: 'width and height scale together',
      });
    });

    it('splits on the first separator only, leaving later dashes in the body', () => {
      expect(
        splitTooltipLabel('Width — computed — do not edit')
      ).toEqual({
        header: 'Width',
        body: 'computed — do not edit',
      });
    });

    it('trims surrounding whitespace from both parts', () => {
      expect(splitTooltipLabel('  Width   —   the box width  ')).toEqual({
        header: 'Width',
        body: 'the box width',
      });
    });

    it('splits a header of exactly the maximum allowed length', () => {
      const header = 'a'.repeat(32);
      expect(splitTooltipLabel(`${header} — described`)).toEqual({
        header,
        body: 'described',
      });
    });

    it('preserves newlines in the body so multi-line tooltips still list', () => {
      expect(
        splitTooltipLabel('Style Overrides — width: 10px\nheight: 20px')
      ).toEqual({
        header: 'Style Overrides',
        body: 'width: 10px\nheight: 20px',
      });
    });
  });

  describe('labels that must not be split', () => {
    it('returns no header when the label has no separator', () => {
      const label = 'Backdrop filter applies effects to content behind this.';
      expect(splitTooltipLabel(label)).toEqual({ header: null, body: label });
    });

    it('returns no header for a short single-word label', () => {
      expect(splitTooltipLabel('Close')).toEqual({
        header: null,
        body: 'Close',
      });
    });

    it('returns no header when the leading segment is too long to be a field name', () => {
      const label =
        'This whole first clause is far too long to be a field name — so leave it alone';
      expect(splitTooltipLabel(label)).toEqual({ header: null, body: label });
    });

    it('does not split an unspaced em dash inside a word', () => {
      expect(splitTooltipLabel('well—known value')).toEqual({
        header: null,
        body: 'well—known value',
      });
    });

    it('does not split a spaced hyphen, which is common in prose', () => {
      expect(splitTooltipLabel('Width - the box width')).toEqual({
        header: null,
        body: 'Width - the box width',
      });
    });

    it('returns no header when nothing follows the separator', () => {
      expect(splitTooltipLabel('Width — ')).toEqual({
        header: null,
        body: 'Width — ',
      });
    });

    it('returns no header when nothing precedes the separator', () => {
      expect(splitTooltipLabel(' — the box width')).toEqual({
        header: null,
        body: ' — the box width',
      });
    });

    it('returns no header for an empty string', () => {
      expect(splitTooltipLabel('')).toEqual({ header: null, body: '' });
    });

    it('returns no header for a whitespace-only label', () => {
      expect(splitTooltipLabel('   ')).toEqual({ header: null, body: '   ' });
    });
  });
});
