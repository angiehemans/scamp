import { describe, it, expect } from 'vitest';
import {
  classifyBackgroundValue,
  isImageBackground,
} from '@lib/backgroundValue';

/**
 * `generateCode` writes the `background` shorthand, which takes a colour or
 * an image. The canvas uses longhands, so it has to pick the right one:
 * `background-color: radial-gradient(…)` is invalid CSS and the browser
 * drops it silently, which is why gradients rendered in the preview but not
 * on the canvas.
 *
 * see docs/notes/canvas-gradient-backgrounds.md
 */

describe('classifyBackgroundValue — colours', () => {
  it('treats a hex colour as a colour', () => {
    expect(classifyBackgroundValue('#ff0000')).toBe('color');
  });

  it('treats rgb/rgba as a colour', () => {
    expect(classifyBackgroundValue('rgba(0, 0, 0, 0.5)')).toBe('color');
  });

  it('treats a modern rgb with a slash alpha as a colour, not a shorthand', () => {
    // The `/` here is inside the function, so it must not be mistaken for
    // the position/size separator of a background shorthand.
    expect(classifyBackgroundValue('rgb(0 0 0 / 50%)')).toBe('color');
  });

  it('treats a token reference as a colour', () => {
    expect(classifyBackgroundValue('var(--accent)')).toBe('color');
  });

  it('treats keywords as colours', () => {
    expect(classifyBackgroundValue('transparent')).toBe('color');
    expect(classifyBackgroundValue('currentColor')).toBe('color');
  });

  it('treats an empty value as a colour, matching the default field', () => {
    expect(classifyBackgroundValue('')).toBe('color');
    expect(classifyBackgroundValue('   ')).toBe('color');
  });
});

describe('classifyBackgroundValue — images', () => {
  it('routes a radial gradient to background-image', () => {
    // The design-podcast hero glow.
    expect(
      classifyBackgroundValue(
        'radial-gradient(circle 640px at 50% 410px, rgba(160,140,255,.2) 0%, rgba(7,6,15,0) 70%)'
      )
    ).toBe('image');
  });

  it('routes a linear gradient to background-image', () => {
    expect(classifyBackgroundValue('linear-gradient(to right, #fff, #000)')).toBe(
      'image'
    );
  });

  it('routes a conic gradient to background-image', () => {
    expect(classifyBackgroundValue('conic-gradient(from 0deg, red, blue)')).toBe(
      'image'
    );
  });

  it('routes a repeating gradient to background-image', () => {
    expect(
      classifyBackgroundValue('repeating-linear-gradient(45deg, #000 0 10px, #fff 10px 20px)')
    ).toBe('image');
  });

  it('routes a bare url() to background-image', () => {
    expect(classifyBackgroundValue('url(/assets/hero.webp)')).toBe('image');
  });

  it('routes multiple stacked gradients to background-image', () => {
    expect(
      classifyBackgroundValue(
        'linear-gradient(#0000, #000), radial-gradient(circle, #fff, #0000)'
      )
    ).toBe('image');
  });

  it('is case-insensitive about the function name', () => {
    expect(classifyBackgroundValue('LINEAR-GRADIENT(to top, red, blue)')).toBe(
      'image'
    );
  });
});

describe('classifyBackgroundValue — positioned shorthands', () => {
  it('keeps a value with a position/size slash on the shorthand', () => {
    // `background-image` alone cannot express `center / cover`.
    expect(classifyBackgroundValue('url(/a.png) center / cover')).toBe(
      'shorthand'
    );
  });

  it('keeps a value with a repeat keyword on the shorthand', () => {
    expect(classifyBackgroundValue('url(/a.png) no-repeat')).toBe('shorthand');
  });

  it('keeps a value with a box keyword on the shorthand', () => {
    expect(classifyBackgroundValue('url(/a.png) padding-box')).toBe('shorthand');
  });

  it('does not mistake a gradient stop percentage for a shorthand', () => {
    expect(
      classifyBackgroundValue('linear-gradient(to right, red 0%, blue 100%)')
    ).toBe('image');
  });
});

describe('isImageBackground', () => {
  it('is true only for values that belong on background-image', () => {
    expect(isImageBackground('linear-gradient(red, blue)')).toBe(true);
    expect(isImageBackground('#fff')).toBe(false);
    expect(isImageBackground('url(/a.png) no-repeat')).toBe(false);
  });
});
