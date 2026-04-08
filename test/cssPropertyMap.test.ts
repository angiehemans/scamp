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
      expect(apply('border-radius', '8px')).toEqual({ borderRadius: 8 });
    });
    it('returns 0 for an empty value', () => {
      expect(apply('border-radius', '')).toEqual({ borderRadius: 0 });
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
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#000',
      });
    });
    it('parses individual longhands', () => {
      expect(apply('border-width', '1px')).toEqual({ borderWidth: 1 });
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
    it('parses a unitless decimal', () => {
      expect(apply('line-height', '1.5')).toEqual({ lineHeight: 1.5 });
    });
    it('parses an integer multiplier', () => {
      expect(apply('line-height', '2')).toEqual({ lineHeight: 2 });
    });
    it('rejects px form for POC', () => {
      expect(apply('line-height', '24px')).toEqual({});
    });
    it('drops empty input', () => {
      expect(apply('line-height', '')).toEqual({});
    });
  });

  describe('letter-spacing', () => {
    it('parses a px value', () => {
      expect(apply('letter-spacing', '2px')).toEqual({ letterSpacing: 2 });
    });
    it('parses a negative px value', () => {
      expect(apply('letter-spacing', '-1px')).toEqual({ letterSpacing: -1 });
    });
    it('drops empty input', () => {
      expect(apply('letter-spacing', '')).toEqual({});
    });
  });

  describe('text properties', () => {
    it('maps font-size', () => {
      expect(apply('font-size', '14px')).toEqual({ fontSize: 14 });
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
});

describe('isMappedProperty', () => {
  it('returns true for a known property', () => {
    expect(isMappedProperty('background')).toBe(true);
  });
  it('returns false for an unknown property', () => {
    expect(isMappedProperty('box-shadow')).toBe(false);
  });
});
