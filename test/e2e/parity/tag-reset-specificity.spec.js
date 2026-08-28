import { test, expect } from '../fixtures/app';
import { canvasElement, pageRoot } from '../fixtures/selectors';
/**
 * Regression test for the canvas tag reset outranking the page's own CSS.
 *
 * `.element:is(button, a, …) { all: unset }` takes the specificity of its
 * most specific argument, making it (0,1,1) — above the (0,1,0) class rules
 * the generator writes. Every page-authored property was silently discarded
 * for those seven tags, so a link ignored its colour, font-size and weight
 * on the canvas while rendering them correctly in the preview.
 *
 * It was latent for as long as the canvas styled elements inline (inline
 * beats any rule) and surfaced when the parity peel moved paint and
 * typography into the injected stylesheet.
 *
 * Both directions matter and both are asserted here: the page must win
 * where it sets something, and the reset must still apply where it does
 * not — otherwise a `button`-tagged rectangle goes back to looking like a
 * system button. see docs/notes/canvas-tag-reset-specificity.md
 */
const HOME_TSX = `import styles from './page.module.css';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <a data-scamp-id="styled_link" className={styles.styled_link} href="#x">Styled link</a>
      <button data-scamp-id="styled_button" className={styles.styled_button}>Styled button</button>
      <a data-scamp-id="bare_anchor" className={styles.bare_anchor} href="#y">Bare link</a>
      <p data-scamp-id="plain_text" className={styles.plain_text}>Plain text</p>
    </div>
  );
}
`;
const HOME_CSS = `.root {
}

.styled_link {
  color: rgb(0, 200, 100);
  font-size: 31px;
  font-weight: 700;
  letter-spacing: 3px;
}

.styled_button {
  color: rgb(200, 0, 100);
  font-size: 27px;
}

/* Sized only — says nothing about text-decoration, which is the point.
   It carries a property so the rule is not empty, and its trailing token
   differs from the styled link's: Scamp reads that token as the element
   id, so two classes ending in the same token collide and one is
   renamed. (No backticks in here — this block is inside a template
   literal.) */
.bare_anchor {
  font-size: 19px;
}

.plain_text {
  color: rgb(10, 20, 30);
  font-size: 23px;
}
`;
test.use({
    projectOptions: {
        format: 'nextjs',
        pageContent: { home: { tsx: HOME_TSX, css: HOME_CSS } },
    },
});
const computed = async (window, className, prop) => canvasElement(window, className).evaluate((el, p) => globalThis.getComputedStyle(el).getPropertyValue(p), prop);
test.describe('canvas tag reset: the page wins, the reset only fills in', () => {
    test('an anchor keeps the colour and type its own CSS sets', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await expect(canvasElement(window, 'styled_link')).toBeVisible();
        // With `:is` these all came back as the reset's inherited values.
        expect(await computed(window, 'styled_link', 'color')).toBe('rgb(0, 200, 100)');
        expect(await computed(window, 'styled_link', 'font-size')).toBe('31px');
        expect(await computed(window, 'styled_link', 'font-weight')).toBe('700');
        expect(await computed(window, 'styled_link', 'letter-spacing')).toBe('3px');
    });
    test('a button keeps the colour and size its own CSS sets', async ({ window, }) => {
        await expect(canvasElement(window, 'styled_button')).toBeVisible();
        expect(await computed(window, 'styled_button', 'color')).toBe('rgb(200, 0, 100)');
        expect(await computed(window, 'styled_button', 'font-size')).toBe('27px');
    });
    test('the reset still strips browser chrome the page says nothing about', async ({ window, }) => {
        // The other half of the fix: a link the page does not style must still
        // lose the UA underline, or every `a` on the canvas grows one.
        await expect(canvasElement(window, 'bare_anchor')).toBeVisible();
        expect(await computed(window, 'bare_anchor', 'text-decoration-line')).toBe('none');
    });
    test('an untagged text element was never affected either way', async ({ window, }) => {
        // The control: the reset names seven tags and `p` is not one of them,
        // so this is what "working" looked like throughout the bug.
        await expect(canvasElement(window, 'plain_text')).toBeVisible();
        expect(await computed(window, 'plain_text', 'color')).toBe('rgb(10, 20, 30)');
        expect(await computed(window, 'plain_text', 'font-size')).toBe('23px');
    });
});
