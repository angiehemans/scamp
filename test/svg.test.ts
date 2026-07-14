// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import {
  isSvgMarkup,
  sanitizeSvg,
  sanitizeSvgInner,
  prepareSvgForInsert,
  extractSvgColors,
  replaceSvgColor,
} from '../src/renderer/src/lib/svg';

describe('isSvgMarkup', () => {
  it('accepts a bare svg element', () => {
    expect(isSvgMarkup('<svg viewBox="0 0 10 10"></svg>')).toBe(true);
  });

  it('accepts a self-closing svg and leading whitespace', () => {
    expect(isSvgMarkup('   <svg/>')).toBe(true);
  });

  it('accepts an svg preceded by an xml declaration and a comment', () => {
    expect(
      isSvgMarkup('<?xml version="1.0"?>\n<!-- icon -->\n<svg></svg>')
    ).toBe(true);
  });

  it('rejects non-svg text and other markup', () => {
    expect(isSvgMarkup('hello world')).toBe(false);
    expect(isSvgMarkup('<div><svg></svg></div>')).toBe(false);
    expect(isSvgMarkup('')).toBe(false);
  });
});

describe('sanitizeSvg', () => {
  it('removes a <script> element but keeps the shapes', () => {
    const out = sanitizeSvg(
      '<svg><script>alert(1)</script><circle r="5"/></svg>'
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).toMatch(/<circle/i);
  });

  it('strips inline event-handler attributes', () => {
    const out = sanitizeSvg('<svg onload="alert(1)"><path d="M0 0"/></svg>');
    expect(out.toLowerCase()).not.toContain('onload');
    expect(out).toMatch(/<path/i);
  });

  it('drops <foreignObject> payloads', () => {
    const out = sanitizeSvg(
      '<svg><foreignObject><iframe src="x"></iframe></foreignObject></svg>'
    );
    expect(out.toLowerCase()).not.toContain('foreignobject');
    expect(out.toLowerCase()).not.toContain('<iframe');
  });
});

describe('sanitizeSvgInner', () => {
  it('returns sanitized inner shape markup without the svg wrapper', () => {
    const out = sanitizeSvgInner('<circle r="5"/><path d="M0 0"/>');
    expect(out).toMatch(/<circle/i);
    expect(out).toMatch(/<path/i);
    expect(out.toLowerCase()).not.toContain('<svg');
  });

  it('strips scripts from inner markup', () => {
    const out = sanitizeSvgInner('<script>alert(1)</script><circle r="5"/>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).toMatch(/<circle/i);
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeSvgInner('   ')).toBe('');
  });
});

describe('prepareSvgForInsert', () => {
  it('returns the inner source and viewBox for a valid svg', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>'
    );
    expect(result).not.toBeNull();
    expect(result!.viewBox).toBe('0 0 24 24');
    expect(result!.svgSource).toMatch(/<circle/i);
  });

  it('derives width/height from explicit attributes', () => {
    const result = prepareSvgForInsert(
      '<svg width="48" height="32" viewBox="0 0 24 16"><rect/></svg>'
    );
    expect(result!.width).toBe(48);
    expect(result!.height).toBe(32);
  });

  it('falls back to viewBox dimensions when width/height are absent', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 64 40"><rect/></svg>'
    );
    expect(result!.width).toBe(64);
    expect(result!.height).toBe(40);
  });

  it('keeps an explicit viewBox verbatim', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 24 24" width="48" height="48"><rect/></svg>'
    );
    expect(result!.viewBox).toBe('0 0 24 24');
  });

  it('synthesizes a viewBox from intrinsic size when the source omits one', () => {
    // Without a viewBox the rendered <svg> can't scale its shapes to the
    // element box — derive one from width/height so resizing scales the art.
    const result = prepareSvgForInsert(
      '<svg width="32" height="20"><rect/></svg>'
    );
    expect(result!.viewBox).toBe('0 0 32 20');
  });

  it("preserves shapes' own fill/stroke so each colour stays editable", () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 10 10"><path d="M0 0" fill="#ff0000" stroke="blue"/></svg>'
    );
    const src = result!.svgSource.toLowerCase();
    // Per-shape colours are kept (backlog-6 story 3) so the SVG Colours
    // editor can surface and rewrite each one individually.
    expect(src).toContain('<path');
    expect(src).toContain('fill="#ff0000"');
    expect(src).toContain('stroke="blue"');
  });

  it('preserves both fill="none" and a solid stroke on the same shape', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 10 10"><circle r="4" fill="none" stroke="red"/></svg>'
    );
    const src = result!.svgSource.toLowerCase();
    expect(src).toContain('fill="none"');
    expect(src).toContain('stroke="red"');
  });

  it('drops a fully-invisible bounding-box shape (fill=none AND stroke=none)', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M0 0h24v24H0z" fill="none" stroke="none"/><path d="M4 6h16"/></svg>'
    );
    const src = result!.svgSource;
    // The transparent box is gone; the stroked path remains.
    expect(src).not.toContain('M0 0h24v24H0z');
    expect(src).toContain('M4 6h16');
  });

  it('keeps a shape that is fill=none but visibly stroked', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 10 10"><circle r="4" fill="none" stroke="red"/></svg>'
    );
    expect(result!.svgSource).toContain('<circle');
  });

  it('hoists the root <svg> fill/stroke/stroke-width into element paint', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 24 24" fill="none" stroke="#00ff00" stroke-width="2"><path d="M0 0"/></svg>'
    );
    expect(result!.fill).toBe('none');
    expect(result!.stroke).toBe('#00ff00');
    expect(result!.strokeWidth).toBe(2);
  });

  it('sanitizes script content out of the prepared source', () => {
    const result = prepareSvgForInsert(
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle r="5"/></svg>'
    );
    expect(result!.svgSource.toLowerCase()).not.toContain('<script');
    expect(result!.svgSource).toMatch(/<circle/i);
  });

  it('returns null for non-svg input', () => {
    expect(prepareSvgForInsert('<div>not svg</div>')).toBeNull();
    expect(prepareSvgForInsert('')).toBeNull();
    expect(prepareSvgForInsert('just text')).toBeNull();
  });
});

describe('extractSvgColors', () => {
  it('collects unique concrete colours from fill and stroke attributes', () => {
    const { colors, hasCurrentColor } = extractSvgColors(
      '<path fill="#ff0000" stroke="#00ff00"/><circle fill="#ff0000"/>'
    );
    expect(colors).toEqual(['#ff0000', '#00ff00']);
    expect(hasCurrentColor).toBe(false);
  });

  it('reads colours from inline style properties', () => {
    const { colors } = extractSvgColors(
      '<path style="fill:#123456;stroke:#abcdef"/>'
    );
    expect(colors).toEqual(['#123456', '#abcdef']);
  });

  it('includes gradient stop-color values', () => {
    const { colors } = extractSvgColors(
      '<defs><linearGradient><stop stop-color="#111111"/><stop stop-color="#222222"/></linearGradient></defs>'
    );
    expect(colors).toEqual(['#111111', '#222222']);
  });

  it('flags currentColor separately and skips none / url() paints', () => {
    const { colors, hasCurrentColor } = extractSvgColors(
      '<path fill="currentColor" stroke="none"/><rect fill="url(#grad)"/>'
    );
    expect(colors).toEqual([]);
    expect(hasCurrentColor).toBe(true);
  });

  it('dedupes case-insensitively but keeps the first-seen spelling', () => {
    const { colors } = extractSvgColors(
      '<path fill="#ABCDEF"/><path fill="#abcdef"/>'
    );
    expect(colors).toEqual(['#ABCDEF']);
  });

  it('returns empty for malformed / empty input', () => {
    expect(extractSvgColors('')).toEqual({ colors: [], hasCurrentColor: false });
  });
});

describe('replaceSvgColor', () => {
  it('rewrites every occurrence across attributes', () => {
    const out = replaceSvgColor(
      '<path fill="#ff0000"/><circle stroke="#ff0000"/>',
      '#ff0000',
      '#0000ff'
    );
    expect(out).toContain('fill="#0000ff"');
    expect(out).toContain('stroke="#0000ff"');
    expect(out).not.toContain('#ff0000');
  });

  it('rewrites a colour inside an inline style', () => {
    const out = replaceSvgColor(
      '<path style="fill:#111111;stroke:#222222"/>',
      '#111111',
      '#999999'
    );
    expect(out.toLowerCase()).toContain('fill:#999999');
    expect(out).toContain('#222222');
  });

  it('is case-insensitive on the source colour', () => {
    const out = replaceSvgColor('<path fill="#ABCDEF"/>', '#abcdef', '#000000');
    expect(out).toContain('fill="#000000"');
  });

  it('leaves unrelated colours and none untouched', () => {
    const out = replaceSvgColor(
      '<path fill="#ff0000" stroke="none"/><circle fill="#00ff00"/>',
      '#ff0000',
      '#0000ff'
    );
    expect(out).toContain('stroke="none"');
    expect(out).toContain('fill="#00ff00"');
  });

  it('returns the input unchanged on malformed markup', () => {
    expect(replaceSvgColor('', '#000', '#fff')).toBe('');
  });
});
