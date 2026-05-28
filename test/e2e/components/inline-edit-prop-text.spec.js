import { test, expect } from '../fixtures/app';
import { pageRoot } from '../fixtures/selectors';
import { waitForSaved } from '../fixtures/assertions';
test.use({
    projectOptions: {
        format: 'nextjs',
        components: [
            {
                name: 'Card',
                tsxContent: `import styles from './Card.module.css';

type CardProps = { title?: string };

export default function Card({ title = "Default" }: CardProps) {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <p data-scamp-id="text_aaaa" className={styles.text_aaaa}>{title}</p>
    </div>
  );
}
`,
                cssContent: `.root {
  width: 200px;
  min-height: 100px;
  background: #f0f0f0;
}

.text_aaaa {
  color: #111;
  font-size: 16px;
}
`,
            },
        ],
        pageContent: {
            home: {
                tsx: `import styles from './page.module.css';
import Card from '@/components/Card/Card';

export default function HomePage() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <Card data-scamp-instance-id="inst_xxxx" title="Hello" />
    </div>
  );
}
`,
                css: `.root {
  width: 100%;
  min-height: 900px;
  background: #fff;
}
`,
            },
        },
    },
});
test.describe('components: inline-edit of prop text on an instance', () => {
    test('dashed outline appears only when instance is selected, and double-click opens contenteditable', async ({ window, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await waitForSaved(window);
        // The instance renders inline; the prop-text inside it carries
        // `data-scamp-prop="title"`.
        const propText = window.locator('[data-scamp-prop="title"]');
        await expect(propText).toBeVisible();
        // No selection yet — no dashed outline.
        let outline = await propText.evaluate((el) => globalThis.getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe('dashed');
        // Click the prop-text once. The canvas chrome layer routes the hit
        // to the wrapper, so this selects the component instance — not
        // the prop-text.
        // Select the instance via its layers-panel row — the canvas
        // chrome layer sits on top of the prop-text and breaks
        // Playwright's actionability check on the rendered text itself.
        // The seeded instance id is `inst_xxxx`; the parser slices the
        // `inst_` prefix for the canvas element id (`xxxx`).
        const layerRow = window.locator('[data-testid="layers-row"][data-element-id="xxxx"]');
        await layerRow.locator('button').first().click();
        // Now the instance is selected — the dashed affordance should
        // show on the prop-text.
        outline = await propText.evaluate((el) => globalThis.getComputedStyle(el).outlineStyle);
        expect(outline).toBe('dashed');
        // Double-click on the canvas chrome at the prop-text's center.
        // The chrome layer's `handleDoubleClick` walks
        // `propTextHitTest` and dispatches `setEditingInstanceProp`.
        const box = await propText.boundingBox();
        if (!box)
            throw new Error('prop-text has no bounding box');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        // DEBUG: dump elementsFromPoint so we can see whether propText
        // is actually first in the stack at this point.
        const stack = await window.evaluate(([clientX, clientY]) => document
            .elementsFromPoint(clientX, clientY)
            .slice(0, 8)
            .map((node) => {
            if (!(node instanceof HTMLElement))
                return '(not html)';
            const tag = node.tagName.toLowerCase();
            const id = node.dataset['elementId'] ?? '';
            const propName = node.dataset['scampProp'] ?? '';
            const instance = node.dataset['scampInstanceId'] ?? '';
            return `${tag}[el=${id}][prop=${propName}][inst=${instance}]`;
        }), [x, y]);
        const allMatches = await window.evaluate(() => Array.from(document.querySelectorAll('[data-scamp-prop="title"]')).map((n) => {
            const tag = n.tagName.toLowerCase();
            const r = n.getBoundingClientRect();
            return `${tag} @ ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        }));
        console.log('matches:', allMatches);
        console.log('propText box:', box);
        console.log('elementsFromPoint:', stack);
        // Also try with offset 5px inside the box (in case center hits a gap).
        const stack2 = await window.evaluate(([clientX, clientY]) => document
            .elementsFromPoint(clientX, clientY)
            .slice(0, 8)
            .map((node) => {
            if (!(node instanceof HTMLElement))
                return '(not html)';
            const tag = node.tagName.toLowerCase();
            const id = node.dataset['elementId'] ?? '';
            const propName = node.dataset['scampProp'] ?? '';
            const instance = node.dataset['scampInstanceId'] ?? '';
            return `${tag}[el=${id}][prop=${propName}][inst=${instance}]`;
        }), [box.x + 5, box.y + 5]);
        console.log('elementsFromPoint(off):', stack2);
        await window.mouse.dblclick(x, y);
        await expect(propText).toHaveAttribute('contenteditable', 'true');
    });
});
