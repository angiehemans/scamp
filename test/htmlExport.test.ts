import { describe, it, expect } from 'vitest';
import { buildHtmlExport, THEME_FILE, type ExportFile } from '@lib/htmlExport';
import { generateCode } from '@lib/generateCode';
import { ROOT_ELEMENT_ID, type ScampElement } from '@lib/element';
import { DEFAULT_RECT_STYLES, DEFAULT_ROOT_STYLES } from '@lib/defaults';

/**
 * Sources are produced by `generateCode` rather than hand-written, so these
 * exercise the real path a project takes: model → files on disk → parsed
 * back → exported. A hand-written fixture could drift from what Scamp
 * actually writes and quietly stop testing anything.
 */

const makeRoot = (childIds: string[]): ScampElement => ({
  ...DEFAULT_ROOT_STYLES,
  id: ROOT_ELEMENT_ID,
  type: 'rectangle',
  parentId: null,
  childIds,
  x: 0,
  y: 0,
  customProperties: {},
  inlineFragments: [],
});

const makeEl = (
  id: string,
  overrides: Partial<ScampElement> = {}
): ScampElement => ({
  ...DEFAULT_RECT_STYLES,
  id,
  type: 'rectangle',
  parentId: ROOT_ELEMENT_ID,
  childIds: [],
  x: 0,
  y: 0,
  customProperties: {},
  inlineFragments: [],
  ...overrides,
});

const asMap = (els: ScampElement[]): Record<string, ScampElement> =>
  Object.fromEntries(els.map((el) => [el.id, el]));

const sourceFor = (
  name: string,
  els: ScampElement[],
  isComponent = false
): { name: string; tsxContent: string; cssContent: string } => {
  const { tsx, css } = generateCode({
    elements: asMap(els),
    rootId: ROOT_ELEMENT_ID,
    pageName: name,
    isComponent,
  });
  return { name, tsxContent: tsx, cssContent: css };
};

const fileAt = (files: ExportFile[], path: string): ExportFile => {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`no exported file at ${path}`);
  return found;
};

const simpleHome = (): { name: string; tsxContent: string; cssContent: string } =>
  sourceFor('home', [
    makeRoot(['a1b2']),
    makeEl('a1b2', { name: 'Hero', backgroundColor: '#ff0000' }),
  ]);

describe('buildHtmlExport — folder shape', () => {
  it('writes an index and stylesheet at the root for the home page', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome()],
      components: [],
      themeCss: ':root { --accent: red; }',
    });
    expect(files.map((f) => f.path).sort()).toEqual([
      'index.css',
      'index.html',
      'theme.css',
    ]);
  });

  it('gives a non-home page its own directory', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome(), sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: '',
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain('about/index.html');
    expect(paths).toContain('about/index.css');
  });

  it('writes one shared theme stylesheet regardless of page count', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome(), sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: ':root { --accent: red; }',
    });
    expect(files.filter((f) => f.path === THEME_FILE)).toHaveLength(1);
    expect(fileAt(files, THEME_FILE).contents).toContain('--accent: red;');
  });
});

describe('buildHtmlExport — documents', () => {
  it('produces a complete HTML document per page', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome()],
      components: [],
      themeCss: '',
    });
    const html = fileAt(files, 'index.html').contents;
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Demo</title>');
    expect(html).toContain('class="hero_a1b2"');
  });

  it('links the theme at the right depth from each page', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome(), sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'index.html').contents).toContain('href="theme.css"');
    expect(fileAt(files, 'about/index.html').contents).toContain(
      'href="../theme.css"'
    );
  });

  it('links each page stylesheet as a plain sibling filename', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'about/index.html').contents).toContain(
      'href="index.css"'
    );
  });

  it('carries the page rules into the page stylesheet', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome()],
      components: [],
      themeCss: '',
    });
    const css = fileAt(files, 'index.css').contents;
    expect(css).toContain('.hero_a1b2');
    expect(css).toContain('#ff0000');
  });
});

describe('buildHtmlExport — links', () => {
  const linked = (): { name: string; tsxContent: string; cssContent: string } =>
    sourceFor('home', [
      makeRoot(['l1']),
      makeEl('l1', { tag: 'a', attributes: { href: '/about' } }),
    ]);

  it('rewrites a route link to the exported file', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [linked(), sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'index.html').contents).toContain(
      'href="about/index.html"'
    );
  });

  it('leaves a link to a page that was not exported alone', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [linked()],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'index.html').contents).toContain('href="/about"');
  });
});

describe('buildHtmlExport — assets', () => {
  const withImage = (
    pageName: string
  ): { name: string; tsxContent: string; cssContent: string } =>
    sourceFor(pageName, [
      makeRoot(['i1']),
      makeEl('i1', { type: 'image', src: '/assets/hero.webp', alt: 'Hero' }),
    ]);

  it('makes an image path relative on the home page', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [withImage('home')],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'index.html').contents).toContain(
      'src="assets/hero.webp"'
    );
  });

  it('climbs out of the directory for a nested page', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [withImage('about')],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'about/index.html').contents).toContain(
      'src="../assets/hero.webp"'
    );
  });

  it('keeps theme urls root-relative, since css resolves against the stylesheet', () => {
    // theme.css lives at the export root and is shared by every page, so its
    // urls must not be rewritten for any one page's depth.
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [sourceFor('about', [makeRoot([])])],
      components: [],
      themeCss: '@font-face { src: url(/assets/font.woff2); }',
    });
    expect(fileAt(files, THEME_FILE).contents).toContain(
      'url(assets/font.woff2)'
    );
  });
});

describe('buildHtmlExport — components', () => {
  const sidebarRow = (): { name: string; tsxContent: string; cssContent: string } =>
    sourceFor(
      'SidebarRow',
      [
        makeRoot(['d3e4']),
        makeEl('d3e4', {
          type: 'text',
          name: 'label',
          prop: 'label',
          text: 'Home',
          backgroundColor: '#00ff00',
        }),
      ],
      true
    );

  const pageWithInstances = (): {
    name: string;
    tsxContent: string;
    cssContent: string;
  } =>
    sourceFor('home', [
      makeRoot(['i1', 'i2']),
      makeEl('i1', {
        type: 'component-instance',
        componentName: 'SidebarRow',
        instanceId: 'inst_a024',
        propOverrides: { label: 'First' },
      }),
      makeEl('i2', {
        type: 'component-instance',
        componentName: 'SidebarRow',
        instanceId: 'inst_b135',
        propOverrides: { label: 'Second' },
      }),
    ]);

  const exported = (): ExportFile[] =>
    buildHtmlExport({
      projectName: 'Demo',
      pages: [pageWithInstances()],
      components: [sidebarRow()],
      themeCss: '',
    }).files;

  it('expands instances into plain markup with no component tag left', () => {
    const html = fileAt(exported(), 'index.html').contents;
    expect(html).not.toContain('<SidebarRow');
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });

  it('copies the component rules into the page stylesheet, once per instance', () => {
    const css = fileAt(exported(), 'index.css').contents;
    expect(css).toContain('.inst_a024__root');
    expect(css).toContain('.inst_b135__root');
    // The component's own declaration reaches both copies.
    expect(css.match(/#00ff00/g)?.length).toBe(2);
  });

  it('emits markup whose classes all exist in the stylesheet', () => {
    // The property that makes the export look right: every class the page
    // references is actually defined somewhere it loads.
    const files = exported();
    const html = fileAt(files, 'index.html').contents;
    const css = fileAt(files, 'index.css').contents;
    const classes = [...html.matchAll(/class="([^"]*?)"/g)]
      .flatMap((m) => (m[1] ?? '').split(/\s+/))
      .filter((c) => c.length > 0);
    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(css, `.${cls} missing from the stylesheet`).toContain(`.${cls}`);
    }
  });

  it('still exports when a component referenced by a page is absent', () => {
    const { files } = buildHtmlExport({
      projectName: 'Demo',
      pages: [pageWithInstances()],
      components: [],
      themeCss: '',
    });
    expect(fileAt(files, 'index.html').contents).toContain('missing component');
  });
});

describe('buildHtmlExport — malformed input', () => {
  it('exports a malformed page as an empty document rather than failing', () => {
    // `parseCode` is lenient — unreadable source yields a bare root rather
    // than an exception — so this is the behaviour to pin down. The `skipped`
    // list exists for a parser that does throw; nothing in the current
    // pipeline reaches it.
    const { files, skipped } = buildHtmlExport({
      projectName: 'Demo',
      pages: [
        simpleHome(),
        { name: 'broken', tsxContent: '<<<not tsx', cssContent: '} {' },
      ],
      components: [],
      themeCss: '',
    });
    expect(files.some((f) => f.path === 'index.html')).toBe(true);
    const broken = fileAt(files, 'broken/index.html').contents;
    expect(broken).toContain('<div class="root"></div>');
    expect(skipped).toEqual([]);
  });

  it('reports nothing as skipped for a project that parses cleanly', () => {
    const { skipped } = buildHtmlExport({
      projectName: 'Demo',
      pages: [simpleHome()],
      components: [],
      themeCss: '',
    });
    expect(skipped).toEqual([]);
  });

  it('exports a project with no pages without throwing', () => {
    const { files } = buildHtmlExport({
      projectName: 'Empty',
      pages: [],
      components: [],
      themeCss: '',
    });
    expect(files.map((f) => f.path)).toEqual([THEME_FILE]);
  });
});
