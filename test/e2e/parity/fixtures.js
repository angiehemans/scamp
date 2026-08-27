/**
 * The parity corpus.
 *
 * Each fixture is the TSX + CSS a page would have on disk, plus the same
 * markup written out as plain HTML. The canvas parses the TSX/CSS and
 * renders; a browser renders the HTML against the identical CSS. Any
 * geometry difference between them is a canvas/preview divergence.
 *
 * Hand-written rather than produced by `generateCode`, deliberately —
 * these should look like what a person or an agent writes, which is where
 * the divergences have actually come from.
 *
 * see docs/plans/canvas-preview-parity-plan.md
 */
const page = (body) => `import styles from './home.module.css';

export default function Home() {
  return (
${body}
  );
}
`;
export const PARITY_FIXTURES = [
    {
        name: 'flex-row-stretch-with-sized-sibling',
        why: 'The design-podcast hero. A `width: 100%` child beside a fixed-width sibling: `flex: 1` (basis 0) would give it only the leftovers, `width: 100%` shrinks it proportionally.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="hero_a001" className={styles.hero_a001}>
        <div data-scamp-id="glow_a002" className={styles.glow_a002} />
        <div data-scamp-id="inner_a003" className={styles.inner_a003}>
          <p data-scamp-id="text_a004" className={styles.text_a004}>Hero copy</p>
        </div>
      </div>
    </div>`),
        html: `    <div class="root">
      <div class="hero_a001">
        <div class="glow_a002"></div>
        <div class="inner_a003">
          <p class="text_a004">Hero copy</p>
        </div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
  background: #101014;
}

.hero_a001 {
  width: 100%;
  display: flex;
  justify-content: center;
  position: relative;
}

.glow_a002 {
  width: 480px;
  height: 200px;
  background: #222230;
}

.inner_a003 {
  width: 100%;
  max-width: 600px;
  display: flex;
  background: #303048;
}

.text_a004 {
  width: 200px;
  color: #ffffff;
}
`,
    },
    {
        name: 'flex-column-cross-axis-max-width-centred',
        why: 'A centred, clamped child in a column parent. Substituting `align-self: stretch` would override the parent `align-items` and pin it left.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="col_b001" className={styles.col_b001}>
        <div data-scamp-id="card_b002" className={styles.card_b002} />
      </div>
    </div>`),
        html: `    <div class="root">
      <div class="col_b001">
        <div class="card_b002"></div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.col_b001 {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.card_b002 {
  width: 100%;
  max-width: 320px;
  height: 120px;
  background: #445566;
}
`,
    },
    {
        name: 'absolute-child-in-flex-parent',
        why: 'A decorative layer taken out of flow inside a flex row. If `position: absolute` is lost, it re-enters flow and displaces its siblings.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="row_c001" className={styles.row_c001}>
        <div data-scamp-id="layer_c002" className={styles.layer_c002} />
        <div data-scamp-id="body_c003" className={styles.body_c003} />
      </div>
    </div>`),
        html: `    <div class="root">
      <div class="row_c001">
        <div class="layer_c002"></div>
        <div class="body_c003"></div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.row_c001 {
  width: 100%;
  display: flex;
  position: relative;
}

.layer_c002 {
  width: 400px;
  height: 300px;
  position: absolute;
  left: 0px;
  top: 0px;
  background: #2a2a40;
}

.body_c003 {
  width: 100%;
  height: 160px;
  background: #556677;
}
`,
    },
    {
        name: 'nested-flex-with-gap-and-padding',
        why: 'Plain layout sanity: gap, padding and nesting all resolving the same on both sides.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="outer_d001" className={styles.outer_d001}>
        <div data-scamp-id="a_d002" className={styles.a_d002} />
        <div data-scamp-id="b_d003" className={styles.b_d003} />
        <div data-scamp-id="c_d004" className={styles.c_d004} />
      </div>
    </div>`),
        html: `    <div class="root">
      <div class="outer_d001">
        <div class="a_d002"></div>
        <div class="b_d003"></div>
        <div class="c_d004"></div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.outer_d001 {
  width: 100%;
  display: flex;
  gap: 16px;
  padding: 24px;
  align-items: flex-start;
  position: relative;
}

.a_d002 {
  width: 120px;
  height: 80px;
  background: #334455;
}

.b_d003 {
  width: 100%;
  height: 120px;
  background: #445566;
}

.c_d004 {
  width: 60px;
  height: 40px;
  background: #556677;
}
`,
    },
    {
        name: 'grid-two-columns',
        why: 'Grid tracks and gaps, which the canvas re-derives the same way it does flex.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="grid_e001" className={styles.grid_e001}>
        <div data-scamp-id="cell_e002" className={styles.cell_e002} />
        <div data-scamp-id="cell_e003" className={styles.cell_e003} />
      </div>
    </div>`),
        html: `    <div class="root">
      <div class="grid_e001">
        <div class="cell_e002"></div>
        <div class="cell_e003"></div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.grid_e001 {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  position: relative;
}

.cell_e002 {
  height: 100px;
  background: #334455;
}

.cell_e003 {
  height: 100px;
  background: #445566;
}
`,
    },
    {
        name: 'pseudo-element-before-content',
        why: 'A `::before` badge, which agent.md actively recommends. It occupies real layout space in the browser.',
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="badge_f001" className={styles.badge_f001} />
    </div>`),
        html: `    <div class="root">
      <div class="badge_f001"></div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}

.badge_f001 {
  width: fit-content;
  height: fit-content;
  display: flex;
  background: #334455;
}

.badge_f001::before {
  content: "NEW";
  display: block;
  width: 120px;
  height: 40px;
  background: #ff0000;
}
`,
    },
    {
        name: 'component-instance-isolation',
        why: "Two instances of one component beside a page that also names its root `root`. The page's rules must not reach inside an instance, and each instance must get its own copy of the component's rules — what CSS Modules do on disk. The component's `::before` is the part inline styles cannot express, so it only renders once the component's stylesheet reaches the canvas.",
        components: [
            {
                name: 'Card',
                tsx: `import styles from './Card.module.css';

type CardProps = { className?: string };

export default function Card({ className }: CardProps) {
  return (
    <div data-scamp-id="root" className={\`\${styles.root} \${className ?? ''}\`}>
      <div data-scamp-id="fill_c001" className={styles.fill_c001} />
    </div>
  );
}
`,
                css: `.root {
  width: 200px;
  height: 80px;
  display: flex;
  padding: 10px;
  background: #445566;
}

.root::before {
  content: "";
  display: block;
  width: 30px;
  height: 30px;
  background: #ff0000;
}

.fill_c001 {
  width: 100%;
  height: 100%;
  background: #99aabb;
}
`,
            },
        ],
        tsx: `import styles from './home.module.css';
import Card from '@/components/Card/Card';

export default function Home() {
  return (
    <div data-scamp-id="root" className={styles.root}>
      <Card data-scamp-instance-id="inst_a024" />
      <Card data-scamp-instance-id="inst_b135" />
    </div>
  );
}
`,
        html: `    <div data-scamp-id="root" class="root">
      <div data-scamp-instance-id="inst_a024" data-scamp-id="root" class="Card_root">
        <div data-scamp-id="fill_c001" class="Card_fill_c001"></div>
      </div>
      <div data-scamp-instance-id="inst_b135" data-scamp-id="root" class="Card_root">
        <div data-scamp-id="fill_c001" class="Card_fill_c001"></div>
      </div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  display: flex;
  gap: 24px;
  padding: 40px;
  position: relative;
  background: #101014;
}
`,
        truthCss: `.Card_root {
  width: 200px;
  height: 80px;
  display: flex;
  padding: 10px;
  background: #445566;
}

.Card_root::before {
  content: "";
  display: block;
  width: 30px;
  height: 30px;
  background: #ff0000;
}

.Card_fill_c001 {
  width: 100%;
  height: 100%;
  background: #99aabb;
}
`,
    },
    {
        name: 'painted-surfaces',
        why: 'Gradients, shadows, filters, blend modes, radii and alpha — everything that produces identical geometry and therefore slips past a geometry-only check. The radial gradient here is the exact shape of the bug that rendered in the preview and not on the canvas.',
        pixels: true,
        tsx: page(`    <div data-scamp-id="root" className={styles.root}>
      <div data-scamp-id="grad_g001" className={styles.grad_g001} />
      <div data-scamp-id="linear_g002" className={styles.linear_g002} />
      <div data-scamp-id="shadow_g003" className={styles.shadow_g003} />
      <div data-scamp-id="filtered_g004" className={styles.filtered_g004} />
      <div data-scamp-id="blended_g005" className={styles.blended_g005} />
    </div>`),
        html: `    <div class="root">
      <div class="grad_g001"></div>
      <div class="linear_g002"></div>
      <div class="shadow_g003"></div>
      <div class="filtered_g004"></div>
      <div class="blended_g005"></div>
    </div>`,
        css: `.root {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  align-items: flex-start;
  position: relative;
  background: #101014;
}

.grad_g001 {
  width: 120px;
  height: 120px;
  background: radial-gradient(circle 60px at 50% 50%, rgba(160, 140, 255, 0.9) 0%, rgba(94, 200, 245, 0.4) 45%, rgba(7, 6, 15, 0) 70%);
}

.linear_g002 {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%);
  border-radius: 24px;
}

.shadow_g003 {
  width: 120px;
  height: 120px;
  background: #445566;
  border-radius: 50%;
  border-width: 4px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0px 12px 32px 0px rgba(160, 140, 255, 0.7);
}

.filtered_g004 {
  width: 120px;
  height: 120px;
  background: linear-gradient(90deg, #22c55e 0%, #3b82f6 100%);
  filter: blur(6px) saturate(180%);
}

.blended_g005 {
  width: 120px;
  height: 120px;
  background: #ff5f6d;
  mix-blend-mode: difference;
}
`,
    },
];
