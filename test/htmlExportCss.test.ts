import { describe, it, expect } from 'vitest';
import {
  assemblePageCss,
  collectKeyframeNames,
  prefixCss,
  prefixSelectorClasses,
  rewriteCssUrls,
} from '@lib/htmlExportCss';

describe('prefixSelectorClasses', () => {
  it('prefixes a single class selector', () => {
    expect(prefixSelectorClasses('.root', 'inst_a024__')).toBe('.inst_a024__root');
  });

  it('prefixes every class in a selector list', () => {
    expect(prefixSelectorClasses('.root, .label_d3e4', 'p__')).toBe(
      '.p__root, .p__label_d3e4'
    );
  });

  it('prefixes every class in a descendant selector, not just the first', () => {
    expect(prefixSelectorClasses('.card .title', 'p__')).toBe('.p__card .p__title');
  });

  it('prefixes classes in compound and pseudo selectors', () => {
    expect(prefixSelectorClasses('.btn.primary:hover', 'p__')).toBe(
      '.p__btn.p__primary:hover'
    );
  });

  it('prefixes a class attached to a child combinator', () => {
    expect(prefixSelectorClasses('.list > .item', 'p__')).toBe('.p__list > .p__item');
  });

  it('leaves element and id selectors alone', () => {
    expect(prefixSelectorClasses('div#main > p', 'p__')).toBe('div#main > p');
  });

  it('does not touch a dot inside an attribute selector value', () => {
    expect(prefixSelectorClasses('[data-x=".foo"]', 'p__')).toBe('[data-x=".foo"]');
  });

  it('prefixes a class that sits beside an attribute selector', () => {
    expect(prefixSelectorClasses('.row[data-open]', 'p__')).toBe(
      '.p__row[data-open]'
    );
  });

  it('leaves a decimal number in a pseudo-class argument alone', () => {
    expect(prefixSelectorClasses(':nth-child(2n+1)', 'p__')).toBe(':nth-child(2n+1)');
  });
});

describe('prefixCss', () => {
  it('prefixes rules and leaves declarations untouched', () => {
    const out = prefixCss('.root { color: red; }', 'inst_a024__');
    expect(out).toContain('.inst_a024__root');
    expect(out).toContain('color: red;');
  });

  it('returns the stylesheet unchanged for an empty prefix', () => {
    const css = '.root { color: red; }';
    expect(prefixCss(css, '')).toBe(css);
  });

  it('prefixes rules nested inside a media query, leaving the prelude alone', () => {
    const out = prefixCss(
      '@media (max-width: 700px) {\n  .root { display: none; }\n}',
      'p__'
    );
    expect(out).toContain('@media (max-width: 700px)');
    expect(out).toContain('.p__root');
  });

  it('renames keyframes so two stylesheets cannot claim the same animation', () => {
    const out = prefixCss(
      '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }',
      'p__'
    );
    expect(out).toContain('@keyframes p__fade');
    expect(out).toContain('from');
    expect(out).toContain('opacity: 0;');
  });

  it('rewrites animation references to match the renamed keyframes', () => {
    const out = prefixCss(
      '.spinner { animation: fade 2s ease-in-out infinite; }\n' +
        '@keyframes fade { from { opacity: 0; } }',
      'p__'
    );
    expect(out).toContain('animation: p__fade 2s ease-in-out infinite;');
    expect(out).toContain('@keyframes p__fade');
  });

  it('rewrites an animation reference inside a media query', () => {
    // The keyframes are declared at the top level, so scanning only the
    // nested block would miss the connection and orphan the reference.
    const out = prefixCss(
      '@keyframes fade { from { opacity: 0; } }\n' +
        '@media (min-width: 600px) { .spinner { animation-name: fade; } }',
      'p__'
    );
    expect(out).toContain('animation-name: p__fade;');
  });

  it('leaves an animation name it did not declare alone', () => {
    const out = prefixCss('.spinner { animation: globalSpin 1s linear; }', 'p__');
    expect(out).toContain('animation: globalSpin 1s linear;');
  });

  it('does not corrupt a quoted content string that looks like a selector', () => {
    const out = prefixCss('.badge::after { content: ".root"; }', 'p__');
    expect(out).toContain('.p__badge::after');
    expect(out).toContain('content: ".root";');
  });

  it('preserves comments', () => {
    const out = prefixCss('/* keep me */\n.root { color: red; }', 'p__');
    expect(out).toContain('/* keep me */');
  });

  it('preserves custom properties, which resolve through the shared theme', () => {
    const out = prefixCss('.root { color: var(--text-primary); }', 'p__');
    expect(out).toContain('var(--text-primary)');
  });

  it('handles a stylesheet with no rules', () => {
    expect(prefixCss('', 'p__')).toBe('');
  });
});

describe('collectKeyframeNames', () => {
  it('finds every declared animation name', () => {
    const names = collectKeyframeNames(
      '@keyframes fade { } @keyframes slide-in { }'
    );
    expect([...names].sort()).toEqual(['fade', 'slide-in']);
  });

  it('returns an empty set for a stylesheet with no animations', () => {
    expect(collectKeyframeNames('.a { color: red; }').size).toBe(0);
  });
});

describe('rewriteCssUrls', () => {
  it('rewrites a bare url', () => {
    expect(
      rewriteCssUrls('.a { background: url(/assets/x.webp); }', () => '../assets/x.webp')
    ).toContain('url(../assets/x.webp)');
  });

  it('preserves the quoting style it found', () => {
    expect(
      rewriteCssUrls(".a { background: url('/assets/x.webp'); }", () => '../assets/x.webp')
    ).toContain("url('../assets/x.webp')");
  });

  it('passes the original url to the rewriter', () => {
    const seen: string[] = [];
    rewriteCssUrls('.a { background: url("/assets/x.webp"); }', (url) => {
      seen.push(url);
      return url;
    });
    expect(seen).toEqual(['/assets/x.webp']);
  });
});

describe('assemblePageCss', () => {
  it('puts the page rules first, then each instance copy', () => {
    const out = assemblePageCss('.root { color: red; }', [
      { prefix: 'inst_a024__', css: '.root { color: blue; }' },
    ]);
    expect(out.indexOf('color: red')).toBeLessThan(out.indexOf('color: blue'));
    expect(out).toContain('.inst_a024__root');
  });

  it('gives each instance of one component its own rule', () => {
    const componentCss = '.root { padding: 8px; }';
    const out = assemblePageCss('.root { color: red; }', [
      { prefix: 'inst_a024__', css: componentCss },
      { prefix: 'inst_b135__', css: componentCss },
    ]);
    expect(out).toContain('.inst_a024__root');
    expect(out).toContain('.inst_b135__root');
  });

  it("leaves the page's own per-instance override rule untouched", () => {
    // This is the rule that sizes an instance. It must survive verbatim or
    // instance sizing silently stops working in the export.
    const out = assemblePageCss('.inst_a024 { width: 300px; }', [
      { prefix: 'inst_a024__', css: '.root { padding: 8px; }' },
    ]);
    expect(out).toContain('.inst_a024 { width: 300px; }');
  });

  it('skips an instance whose component stylesheet is empty', () => {
    const out = assemblePageCss('.root { color: red; }', [
      { prefix: 'inst_a024__', css: '   ' },
    ]);
    expect(out.trim()).toBe('.root { color: red; }');
  });

  it('returns just the page CSS when there are no instances', () => {
    expect(assemblePageCss('.root { color: red; }', []).trim()).toBe(
      '.root { color: red; }'
    );
  });
});
