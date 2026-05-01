import { describe, it, expect } from 'vitest';
import { parseCode } from '@lib/parseCode';
import { ROOT_ELEMENT_ID } from '@lib/element';
/**
 * The pre-canvas-rework generator emitted this exact three-tuple on
 * every root block. Detecting it lets us migrate legacy projects to
 * the new stretch/auto defaults without the user having to edit their
 * CSS by hand.
 */
const LEGACY_TSX = `<div data-scamp-id="root" className={styles.root}>
</div>`;
const legacyCss = (width, minHeight) => `.root {
  width: ${width}px;
  min-height: ${minHeight}px;
  position: relative;
}
`;
describe('root migration', () => {
    it('detects the legacy three-tuple and strips it', () => {
        const parsed = parseCode(LEGACY_TSX, legacyCss(1440, 900));
        expect(parsed.migrated).toBe(true);
        const root = parsed.elements[ROOT_ELEMENT_ID];
        // New stretch/auto defaults apply because the legacy
        // declarations were stripped.
        expect(root.widthMode).toBe('stretch');
        expect(root.heightMode).toBe('auto');
        // None of the legacy properties survive into customProperties.
        expect(root.customProperties).toEqual({});
    });
    it('preserves non-legacy declarations alongside the legacy three-tuple', () => {
        const css = `.root {
  width: 1440px;
  min-height: 900px;
  position: relative;
  background: #ff0000;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBe(true);
        const root = parsed.elements[ROOT_ELEMENT_ID];
        expect(root.backgroundColor).toBe('#ff0000');
    });
    it('does NOT migrate when the user added a fixed height', () => {
        // A user-authored `height: 900px` on root means they actively
        // wanted a fixed-height page — don't reinterpret it as the
        // legacy three-tuple.
        const css = `.root {
  width: 1440px;
  min-height: 900px;
  height: 900px;
  position: relative;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBeUndefined();
    });
    it('does NOT migrate a root with width: 100%', () => {
        const css = `.root {
  width: 100%;
  min-height: 900px;
  position: relative;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBeUndefined();
    });
    it('does NOT migrate a root with a non-relative position value', () => {
        const css = `.root {
  width: 1440px;
  min-height: 900px;
  position: absolute;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBeUndefined();
    });
    it('is a no-op (no migrated flag) for already-migrated CSS', () => {
        const css = `.root {
  position: relative;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBeUndefined();
    });
    it('does NOT migrate when either value is a non-px expression', () => {
        const css = `.root {
  width: calc(1440px + 10px);
  min-height: 900px;
  position: relative;
}
`;
        const parsed = parseCode(LEGACY_TSX, css);
        expect(parsed.migrated).toBeUndefined();
    });
});
