import { describe, it, expect } from 'vitest';

import { generateCode } from '@lib/generateCode';
import { parseCode } from '@lib/parseCode';
import { ROOT_ELEMENT_ID } from '@lib/element';

/**
 * Components must NOT carry the page-root `min-height: 100vh` floor.
 * A component is embedded inside a page, so a viewport-height floor
 * blows out its layout in previews and on live sites. Pages keep the
 * floor (they need visible height in a bare browser).
 * see docs/notes/component-min-height-floor.md
 */

const tsx = `import styles from './Card.module.css';

export default function Card() {
  return (
    <div data-scamp-id="root" className={styles.root} />
  );
}
`;

const regenComponent = (parsed: ReturnType<typeof parseCode>): string =>
  generateCode({
    elements: parsed.elements,
    rootId: parsed.rootId,
    pageName: 'Card',
    breakpoints: [],
    cssModuleImportName: 'Card',
    isComponent: true,
  }).css;

describe('component min-height floor', () => {
  it('does not seed a 100vh floor onto a component root when the CSS omits min-height', () => {
    const css = `.root {\n  width: 100%;\n  position: relative;\n}\n`;
    const parsed = parseCode(tsx, css, { isComponent: true });
    expect(parsed.elements[ROOT_ELEMENT_ID]?.minHeight).toBeUndefined();
    expect(regenComponent(parsed)).not.toContain('min-height');
  });

  it('strips an inherited min-height: 100vh from a component root (self-heal)', () => {
    const css = `.root {\n  width: 100%;\n  min-height: 100vh;\n  position: relative;\n}\n`;
    const parsed = parseCode(tsx, css, { isComponent: true });
    expect(parsed.elements[ROOT_ELEMENT_ID]?.minHeight).toBeUndefined();
    expect(regenComponent(parsed)).not.toContain('100vh');
  });

  it('preserves an explicit non-100vh min-height on a component root', () => {
    const css = `.root {\n  width: 100%;\n  min-height: 300px;\n  position: relative;\n}\n`;
    const parsed = parseCode(tsx, css, { isComponent: true });
    expect(parsed.elements[ROOT_ELEMENT_ID]?.minHeight).toBe('300px');
    expect(regenComponent(parsed)).toContain('min-height: 300px;');
  });

  it('keeps the 100vh floor on a PAGE root (parsed without isComponent)', () => {
    const css = `.root {\n  width: 100%;\n  min-height: 100vh;\n  position: relative;\n}\n`;
    const parsed = parseCode(tsx, css);
    expect(parsed.elements[ROOT_ELEMENT_ID]?.minHeight).toBe('100vh');
    const css2 = generateCode({
      elements: parsed.elements,
      rootId: parsed.rootId,
      pageName: 'home',
      breakpoints: [],
    }).css;
    expect(css2).toContain('min-height: 100vh;');
  });
});
