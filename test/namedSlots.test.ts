import { describe, it, expect } from 'vitest';
import { hoistNamedSlots } from '../src/renderer/lib/parseCode/namedSlots';

describe('hoistNamedSlots', () => {
  it('hoists a single named-slot prop on a self-closing instance', () => {
    const tsx =
      '<Card data-scamp-instance-id="inst_x" left={<div data-scamp-id="rect_a" className={styles.rect_a}>Hi</div>} />';
    const out = hoistNamedSlots(tsx);
    expect(out).toContain('<Card data-scamp-instance-id="inst_x">');
    expect(out).toContain(
      '<div data-scamp-slot="left" data-scamp-id="rect_a" className={styles.rect_a}>Hi</div>'
    );
    expect(out).toContain('</Card>');
    expect(out).not.toContain('left={');
  });

  it('hoists a named slot alongside existing default children', () => {
    const tsx = [
      '<Card data-scamp-instance-id="inst_x" right={<img data-scamp-id="img_b" src="x" />}>',
      '  <p data-scamp-id="text_c">Default</p>',
      '</Card>',
    ].join('\n');
    const out = hoistNamedSlots(tsx);
    // The named-slot content is nested inside the instance; default child stays.
    expect(out).toContain('data-scamp-slot="right"');
    expect(out).toContain('data-scamp-id="img_b"');
    expect(out).toContain('data-scamp-id="text_c"');
    expect(out).not.toContain('right={');
  });

  it('hoists two named slots', () => {
    const tsx =
      '<Split data-scamp-instance-id="inst_x" left={<div data-scamp-id="rect_l">L</div>} right={<div data-scamp-id="rect_r">R</div>} />';
    const out = hoistNamedSlots(tsx);
    expect(out).toContain('data-scamp-slot="left"');
    expect(out).toContain('data-scamp-slot="right"');
    expect(out).toContain('data-scamp-id="rect_l"');
    expect(out).toContain('data-scamp-id="rect_r"');
  });

  it('marks each top-level element of a fragment slot value', () => {
    const tsx =
      '<Card data-scamp-instance-id="inst_x" body={<><div data-scamp-id="rect_a">A</div><div data-scamp-id="rect_b">B</div></>} />';
    const out = hoistNamedSlots(tsx);
    // Both elements carry the marker; the fragment wrapper is gone.
    expect(out).toContain('<div data-scamp-slot="body" data-scamp-id="rect_a">A</div>');
    expect(out).toContain('<div data-scamp-slot="body" data-scamp-id="rect_b">B</div>');
    expect(out).not.toContain('<>');
  });

  it('leaves string props and non-element braced props untouched', () => {
    const tsx =
      '<Card data-scamp-instance-id="inst_x" label="Hello" className={styles.card} />';
    expect(hoistNamedSlots(tsx)).toBe(tsx);
  });

  it('is a no-op when there are no named-slot props', () => {
    const tsx = '<Card data-scamp-instance-id="inst_x" label="Hi" />';
    expect(hoistNamedSlots(tsx)).toBe(tsx);
  });

  it('handles nested elements inside a named slot value', () => {
    const tsx =
      '<Card data-scamp-instance-id="inst_x" header={<div data-scamp-id="rect_a"><span data-scamp-id="text_b">Deep</span></div>} />';
    const out = hoistNamedSlots(tsx);
    expect(out).toContain('<div data-scamp-slot="header" data-scamp-id="rect_a">');
    expect(out).toContain('<span data-scamp-id="text_b">Deep</span>');
    // Only the outer (top-level) element is marked.
    expect(out).not.toContain('data-scamp-slot="header" data-scamp-id="text_b"');
  });
});
