import { describe, it, expect } from 'vitest';

import { generateCode } from '../src/renderer/lib/generateCode';
import { parseCode } from '../src/renderer/lib/parseCode';

/**
 * The "Add Component" flow writes a starter TSX + CSS pair to
 * disk via `createComponent` in `src/main/ipc/componentOps.ts`.
 * If that scaffold doesn't round-trip cleanly through parseCode
 * / generateCode, the renderer's canonical-migration write fires
 * after `loadComponent` and the chokidar `add` event for the
 * raw scaffold then misses the syncBridge echo guard. The
 * handler reloads on top of any rect the user has just drawn,
 * which broke `group-inside-component.spec.ts` and the
 * `css-edits-in-component` specs.
 *
 * see docs/notes/component-scaffold-roundtrip.md
 */

const componentName = 'Card';

const scaffoldTsx = `import styles from './${componentName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root} />
  );
}
`;

// No `min-height: 100vh`: a component root is embedded, not a full
// page, so it must not carry the page-root viewport floor.
// see docs/notes/component-min-height-floor.md
const scaffoldCss = `.root {
  width: 100%;
  position: relative;
}
`;

describe('component scaffold round-trip', () => {
  it('the createComponent scaffold reproduces itself through parseCode → generateCode', () => {
    const parsed = parseCode(scaffoldTsx, scaffoldCss, { isComponent: true });
    const regen = generateCode({
      elements: parsed.elements,
      rootId: parsed.rootId,
      pageName: componentName,
      breakpoints: [],
      customMediaBlocks: parsed.customMediaBlocks,
      pageKeyframesBlocks: parsed.keyframesBlocks,
      cssModuleImportName: componentName,
      isComponent: true,
    });
    expect(regen.tsx).toBe(scaffoldTsx);
    expect(regen.css).toBe(scaffoldCss);
  });
});
