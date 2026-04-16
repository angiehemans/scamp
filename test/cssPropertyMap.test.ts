import { describe, it, expect } from 'vitest';
import { cssToScampProperty, isMappedProperty } from '@lib/cssPropertyMap';

const apply = (prop: string, value: string): Record<string, unknown> => {
  const fn = cssToScampProperty[prop];
  if (!fn) throw new Error(`No mapper for ${prop}`);
  return fn(value);
};

describe('cssToScampProperty', () => {
  describe('background', () => {
    it('maps `background` to backgroundColor', () => {
      expect(apply('background', '#f0f0f0')).toEqual({ backgroundColor: '#f0f0f0' });
    });
    it('maps `background-color` to backgroundColor', () => {
      expect(apply('background-color', 'red')).toEqual({ backgroundColor: 'red' });
    });
  });

  describe('border-radius', () => {
    it('parses px', () => {
      expect(apply('border-radius', '8px')).toEqual({ borderRadius: [8, 8, 8, 8] });
    });
    it('returns 0 for an empty value', () => {
      expect(apply('border-radius', '')).toEqual({ borderRadius: [0, 0, 0, 0] });
    });
  });

  describe('display', () => {
    it('maps flex', () => {
      expect(apply('display', 'flex')).toEqual({ display: 'flex' });
    });
    it('maps anything else to none', () => {
      expect(apply('display', 'block')).toEqual({ display: 'none' });
    });
  });

  describe('flex-direction', () => {
    it('maps row', () => {
      expect(apply('flex-direction', 'row')).toEqual({ flexDirection: 'row' });
    });
    it('maps column', () => {
      expect(apply('flex-direction', 'column')).toEqual({ flexDirection: 'column' });
    });
    it('drops unsupported directions', () => {
      expect(apply('flex-direction', 'row-reverse')).toEqual({});
    });
  });

  describe('gap', () => {
    it('parses px', () => {
      expect(apply('gap', '16px')).toEqual({ gap: 16 });
    });
  });

  describe('align-items', () => {
    it('maps flex-start', () => {
      expect(apply('align-items', 'flex-start')).toEqual({ alignItems: 'flex-start' });
    });
    it('maps center', () => {
      expect(apply('align-items', 'center')).toEqual({ alignItems: 'center' });
    });
    it('drops unsupported values', () => {
      expect(apply('align-items', 'baseline')).toEqual({});
    });
  });

  describe('justify-content', () => {
    it('maps space-between', () => {
      expect(apply('justify-content', 'space-between')).toEqual({
        justifyContent: 'space-between',
      });
    });
    it('drops unsupported values', () => {
      expect(apply('justify-content', 'space-evenly')).toEqual({});
    });
  });

  describe('width / height', () => {
    it('width 100% switches to stretch', () => {
      expect(apply('width', '100%')).toEqual({ widthMode: 'stretch' });
    });
    it('width with px sets fixed mode and value', () => {
      expect(apply('width', '320px')).toEqual({ widthMode: 'fixed', widthValue: 320 });
    });
    it('width fit-content switches to fit-content mode', () => {
      expect(apply('width', 'fit-content')).toEqual({ widthMode: 'fit-content' });
    });
    it('height 100% switches to stretch', () => {
      expect(apply('height', '100%')).toEqual({ heightMode: 'stretch' });
    });
    it('height with px sets fixed mode and value', () => {
      expect(apply('height', '200px')).toEqual({ heightMode: 'fixed', heightValue: 200 });
    });
    it('height fit-content switches to fit-content mode', () => {
      expect(apply('height', 'fit-content')).toEqual({ heightMode: 'fit-content' });
    });
  });

  describe('border', () => {
    it('parses shorthand', () => {
      expect(apply('border', '2px dashed #000')).toEqual({
        borderWidth: [2, 2, 2, 2],
        borderStyle: 'dashed',
        borderColor: '#000',
      });
    });
    it('parses individual longhands', () => {
      expect(apply('border-width', '1px')).toEqual({ borderWidth: [1, 1, 1, 1] });
      expect(apply('border-style', 'dotted')).toEqual({ borderStyle: 'dotted' });
      expect(apply('border-color', 'red')).toEqual({ borderColor: 'red' });
    });
    it('drops unsupported border-style values', () => {
      expect(apply('border-style', 'double')).toEqual({});
    });
  });

  describe('padding', () => {
    it('parses 1-value shorthand', () => {
      expect(apply('padding', '8px')).toEqual({ padding: [8, 8, 8, 8] });
    });
    it('parses 4-value shorthand', () => {
      expect(apply('padding', '1px 2px 3px 4px')).toEqual({ padding: [1, 2, 3, 4] });
    });
  });

  describe('margin', () => {
    it('parses 1-value shorthand', () => {
      expect(apply('margin', '12px')).toEqual({ margin: [12, 12, 12, 12] });
    });
    it('parses 2-value shorthand', () => {
      expect(apply('margin', '4px 8px')).toEqual({ margin: [4, 8, 4, 8] });
    });
    it('parses 3-value shorthand', () => {
      expect(apply('margin', '1px 2px 3px')).toEqual({ margin: [1, 2, 3, 2] });
    });
    it('parses 4-value shorthand', () => {
      expect(apply('margin', '1px 2px 3px 4px')).toEqual({ margin: [1, 2, 3, 4] });
    });
    it('returns zeroed margin for empty input', () => {
      expect(apply('margin', '')).toEqual({ margin: [0, 0, 0, 0] });
    });
  });

  describe('line-height', () => {
    it('preserves a unitless decimal as a string', () => {
      expect(apply('line-height', '1.5')).toEqual({ lineHeight: '1.5' });
    });
    it('preserves an integer multiplier as a string', () => {
      expect(apply('line-height', '2')).toEqual({ lineHeight: '2' });
    });
    it('preserves px form as a string (no longer rejected)', () => {
      expect(apply('line-height', '24px')).toEqual({ lineHeight: '24px' });
    });
    it('preserves var() refs', () => {
      expect(apply('line-height', 'var(--leading-tight)')).toEqual({
        lineHeight: 'var(--leading-tight)',
      });
    });
    it('drops empty input', () => {
      expect(apply('line-height', '')).toEqual({});
    });
  });

  describe('letter-spacing', () => {
    it('preserves a px value as a string', () => {
      expect(apply('letter-spacing', '2px')).toEqual({ letterSpacing: '2px' });
    });
    it('preserves a negative px value', () => {
      expect(apply('letter-spacing', '-1px')).toEqual({ letterSpacing: '-1px' });
    });
    it('preserves rem / em forms', () => {
      expect(apply('letter-spacing', '0.05em')).toEqual({
        letterSpacing: '0.05em',
      });
    });
    it('drops empty input', () => {
      expect(apply('letter-spacing', '')).toEqual({});
    });
  });

  describe('text properties', () => {
    it('maps font-size as a string', () => {
      expect(apply('font-size', '14px')).toEqual({ fontSize: '14px' });
    });
    it('preserves rem font-size', () => {
      expect(apply('font-size', '1.125rem')).toEqual({ fontSize: '1.125rem' });
    });
    it('preserves var() font-size', () => {
      expect(apply('font-size', 'var(--text-lg)')).toEqual({
        fontSize: 'var(--text-lg)',
      });
    });
    it('maps a recognised font-weight', () => {
      expect(apply('font-weight', '600')).toEqual({ fontWeight: 600 });
    });
    it('drops an unrecognised font-weight', () => {
      expect(apply('font-weight', '350')).toEqual({});
    });
    it('maps color', () => {
      expect(apply('color', '#222222')).toEqual({ color: '#222222' });
    });
    it('maps text-align', () => {
      expect(apply('text-align', 'center')).toEqual({ textAlign: 'center' });
    });
    it('drops unsupported text-align', () => {
      expect(apply('text-align', 'justify')).toEqual({});
    });
  });

  describe('display', () => {
    it('maps display: flex to the flex sentinel', () => {
      expect(apply('display', 'flex')).toEqual({ display: 'flex' });
    });
    it('maps display: none to visibilityMode', () => {
      expect(apply('display', 'none')).toEqual({ visibilityMode: 'none' });
    });
    it('maps other display values back to the non-flex sentinel', () => {
      expect(apply('display', 'block')).toEqual({ display: 'none' });
    });
  });

  describe('visibility', () => {
    it('maps visibility: hidden', () => {
      expect(apply('visibility', 'hidden')).toEqual({
        visibilityMode: 'hidden',
      });
    });
    it('maps visibility: visible', () => {
      expect(apply('visibility', 'visible')).toEqual({
        visibilityMode: 'visible',
      });
    });
    it('drops other visibility values', () => {
      expect(apply('visibility', 'collapse')).toEqual({});
    });
  });

  describe('opacity', () => {
    it('parses a decimal', () => {
      expect(apply('opacity', '0.5')).toEqual({ opacity: 0.5 });
    });
    it('parses an integer', () => {
      expect(apply('opacity', '1')).toEqual({ opacity: 1 });
      expect(apply('opacity', '0')).toEqual({ opacity: 0 });
    });
    it('clamps above 1', () => {
      expect(apply('opacity', '1.5')).toEqual({ opacity: 1 });
    });
    it('clamps below 0', () => {
      expect(apply('opacity', '-0.2')).toEqual({ opacity: 0 });
    });
    it('drops non-numeric values', () => {
      expect(apply('opacity', 'auto')).toEqual({});
    });
  });
});

describe('isMappedProperty', () => {
  it('returns true for a known property', () => {
    expect(isMappedProperty('background')).toBe(true);
  });
  it('returns false for an unknown property', () => {
    expect(isMappedProperty('box-shadow')).toBe(false);
  });
});
