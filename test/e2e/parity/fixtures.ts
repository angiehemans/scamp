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

export type ParityFixture = {
  name: string;
  /** Why this shape is worth pinning. */
  why: string;
  tsx: string;
  css: string;
  /**
   * The same markup as plain HTML, for the browser side of the comparison.
   *
   * Hand-written rather than produced by Scamp's own HTML exporter, on
   * purpose: an oracle that shares code with the thing it checks can agree
   * with it while both are wrong. `parity.spec.ts` asserts the two carry
   * the same set of element names, so they can't drift apart silently.
   */
  html: string;
  /**
   * Components to seed on disk, exactly as Scamp would write them.
   */
  components?: ReadonlyArray<{ name: string; tsx: string; css: string }>;
  /**
   * Extra CSS for the BROWSER side only, emulating what CSS Modules do for
   * a component's stylesheet: the same rules under names that can't collide
   * with the page's. Written by hand so the oracle still shares no code
   * with the thing it checks.
   */
  truthCss?: string;
  /**
   * Set when the canvas is known NOT to match yet. The spec asserts these
   * fail, so the gap is recorded and we're told when it closes.
   */
  knownGap?: string;
};

const page = (body: string): string => `import styles from './home.module.css';

export default function Home() {
  return (
${body}
  );
}
`;

export const PARITY_FIXTURES: ReadonlyArray<ParityFixture> = [
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
];