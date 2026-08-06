import { describe, expect, it } from 'vitest';
import { findCssBlocks, findTsxLines, firstLine } from '@lib/codeHighlight';
/**
 * Locating the selected element in the code panel. The panel shows what's on
 * DISK, so these run against reformatted and hand-edited shapes too — not
 * just what `generateCode` happens to emit today.
 * see docs/notes/code-highlight.md
 */
// Exactly what generateCode produces, verified against real output.
const TSX = `import styles from './home.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="rect_a1b2" className={styles.rect_a1b2}>
        <div data-scamp-id="rect_c3d4" className={styles.rect_c3d4} />
      </div>
    </div>
  );
}
`;
const CSS = `.root {
  width: 100px;
}

.rect_a1b2 {
  display: flex;
  gap: 16px;
}

.rect_c3d4 {

}

.rect_c3d4:hover {
  background: #ff0000;
}

@media (max-width: 768px) {
  .rect_a1b2 {
    width: 300px;
  }
}
`;
describe('findTsxLines', () => {
    it('finds the line carrying the element opening tag', () => {
        expect(findTsxLines(TSX, 'rect_a1b2')).toEqual([{ from: 6, to: 6 }]);
    });
    it('finds a self-closing element', () => {
        expect(findTsxLines(TSX, 'rect_c3d4')).toEqual([{ from: 7, to: 7 }]);
    });
    it('finds the page root', () => {
        expect(findTsxLines(TSX, 'root')).toEqual([{ from: 5, to: 5 }]);
    });
    it('finds a component instance by its instance attribute', () => {
        // Instances carry `data-scamp-instance-id`, not `data-scamp-id`.
        const tsx = `    <div data-scamp-id="root" className={styles.root}>
      <Button data-scamp-instance-id="inst_a1b2" label="Go" />
    </div>`;
        expect(findTsxLines(tsx, 'inst_a1b2')).toEqual([{ from: 2, to: 2 }]);
    });
    it('does not match a class that merely starts the same', () => {
        // A substring match would light up the wrong element.
        expect(findTsxLines(TSX, 'rect_a1')).toEqual([]);
    });
    it('tolerates whitespace around the attribute', () => {
        const tsx = `<div data-scamp-id = "rect_x" />`;
        expect(findTsxLines(tsx, 'rect_x')).toEqual([{ from: 1, to: 1 }]);
    });
    it('returns nothing for an element that is not present', () => {
        expect(findTsxLines(TSX, 'rect_gone')).toEqual([]);
    });
    it('returns nothing for empty input', () => {
        expect(findTsxLines('', 'rect_a1b2')).toEqual([]);
        expect(findTsxLines(TSX, '')).toEqual([]);
    });
});
describe('findCssBlocks', () => {
    it('finds the base rule, from selector to closing brace', () => {
        expect(findCssBlocks(CSS, 'rect_a1b2')).toContainEqual({ from: 5, to: 8 });
    });
    it('finds an empty rule block', () => {
        expect(findCssBlocks(CSS, 'rect_c3d4')).toContainEqual({ from: 10, to: 12 });
    });
    it('finds state variants alongside the base rule', () => {
        const blocks = findCssBlocks(CSS, 'rect_c3d4');
        expect(blocks).toHaveLength(2);
        expect(blocks).toContainEqual({ from: 14, to: 16 });
    });
    it('finds the copy nested inside a media query', () => {
        // The breakpoint override is often exactly what the user is looking for.
        expect(findCssBlocks(CSS, 'rect_a1b2')).toContainEqual({ from: 19, to: 21 });
    });
    it('highlights the inner rule, never the @media wrapper', () => {
        // The wrapper holds unrelated elements' overrides too.
        const blocks = findCssBlocks(CSS, 'rect_a1b2');
        // Line 18 is the `@media` line itself.
        expect(blocks.some((b) => b.from === 18)).toBe(false);
    });
    it('does not match a longer class with the same prefix', () => {
        const css = `.rect_a1b2x {\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([]);
    });
    it('matches when the class is a descendant in the selector', () => {
        const css = `.wrap .rect_a1b2 {\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([{ from: 1, to: 3 }]);
    });
    it('matches a multi-line selector list', () => {
        const css = `.other,\n.rect_a1b2 {\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([{ from: 1, to: 4 }]);
    });
    it('handles a rule written entirely on one line', () => {
        const css = `.rect_a1b2 { color: red; }\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([{ from: 1, to: 1 }]);
    });
    it('is not fooled by a brace inside a string value', () => {
        // `content: "}"` would end the block early under naive counting.
        const css = `.rect_a1b2 {\n  content: "}";\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([{ from: 1, to: 4 }]);
    });
    it('is not fooled by a brace inside a comment', () => {
        const css = `.rect_a1b2 {\n  /* } */\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([{ from: 1, to: 4 }]);
    });
    it('ignores the class when it only appears inside a comment', () => {
        const css = `/* .rect_a1b2 was here */\n.other {\n  color: red;\n}\n`;
        expect(findCssBlocks(css, 'rect_a1b2')).toEqual([]);
    });
    it('returns nothing for a class with no rules', () => {
        // True for every component instance — they own no CSS class.
        expect(findCssBlocks(CSS, 'inst_a1b2')).toEqual([]);
    });
    it('returns nothing for empty input', () => {
        expect(findCssBlocks('', 'rect_a1b2')).toEqual([]);
        expect(findCssBlocks(CSS, '')).toEqual([]);
    });
    it('survives an unbalanced brace rather than throwing', () => {
        // A half-saved file from an external editor reaches the panel too.
        expect(() => findCssBlocks(`.rect_a1b2 {\n  color: red;\n`, 'rect_a1b2')).not.toThrow();
    });
});
describe('firstLine', () => {
    it('returns the first range start, for scrolling into view', () => {
        expect(firstLine([{ from: 5, to: 8 }, { from: 18, to: 20 }])).toBe(5);
    });
    it('returns null when there is nothing to reveal', () => {
        expect(firstLine([])).toBeNull();
    });
});
