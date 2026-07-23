import { describe, it, expect } from 'vitest';

import { generateDesignMd, parseDesignMd } from '@lib/designMd';
import type { ThemeToken } from '@shared/types';

const tokens = (map: Record<string, string>): ThemeToken[] =>
  Object.entries(map).map(([name, value]) => ({ name, value }));

const SAMPLE = tokens({
  '--color-brand-500': '#3b82f6',
  '--color-neutral-50': '#f8fafc',
  '--color-primary': 'var(--color-brand-500)',
  '--color-background': 'var(--color-neutral-50)',
  '--font-sans': 'Inter, sans-serif',
  '--text-h1-family': 'var(--font-sans)',
  '--text-h1-size': '2.5rem',
  '--text-h1-weight': '700',
  '--text-h1-leading': '1.2',
  '--radius-md': '8px',
  '--radius-full': '9999px',
  '--space-4': '16px',
});

describe('generateDesignMd', () => {
  it('wraps the token YAML in front-matter fences', () => {
    const out = generateDesignMd(SAMPLE, { name: 'My App', sections: {} });
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('\n---\n');
    expect(out).toContain('name: My App');
  });

  it('emits primitives as hex and semantic tokens as {colors.*} refs', () => {
    const out = generateDesignMd(SAMPLE, { sections: {} });
    expect(out).toContain('  brand-500: "#3b82f6"');
    expect(out).toContain('  primary: "{colors.brand-500}"');
    expect(out).toContain('  background: "{colors.neutral-50}"');
  });

  it('emits typography objects with resolved concrete values', () => {
    const out = generateDesignMd(SAMPLE, { sections: {} });
    expect(out).toMatch(/typography:\n {2}h1:\n {4}fontFamily: "Inter, sans-serif"/);
    expect(out).toContain('    fontSize: 2.5rem');
    expect(out).toContain('    fontWeight: 700');
    expect(out).toContain('    lineHeight: 1.2');
  });

  it('emits rounded + spacing scales from role tokens', () => {
    const out = generateDesignMd(SAMPLE, { sections: {} });
    expect(out).toContain('rounded:\n  md: 8px');
    expect(out).toContain('  full: 9999px');
    expect(out).toContain('spacing:\n  4: 16px');
  });

  it('renders prose sections in spec order, omitting empty ones', () => {
    const out = generateDesignMd(SAMPLE, {
      sections: {
        Overview: 'A portfolio site.',
        Colors: 'Use brand sparingly.',
      },
    });
    expect(out).toContain('## Overview\n\nA portfolio site.');
    expect(out).toContain('## Colors\n\nUse brand sparingly.');
    expect(out).not.toContain('## Typography');
    expect(out.indexOf('## Overview')).toBeLessThan(out.indexOf('## Colors'));
  });
});

describe('parseDesignMd', () => {
  it('reads name / description and section bodies, ignoring token YAML', () => {
    const content = `---
name: My App
description: A small thing.
colors:
  primary: "#000000"
---

## Overview

A portfolio site.

## Colors

Use brand sparingly.
Never raw hex.
`;
    const prose = parseDesignMd(content);
    expect(prose.name).toBe('My App');
    expect(prose.description).toBe('A small thing.');
    expect(prose.sections['Overview']).toBe('A portfolio site.');
    expect(prose.sections['Colors']).toBe(
      'Use brand sparingly.\nNever raw hex.'
    );
    // Token YAML is not surfaced as prose.
    expect(prose.sections['primary']).toBeUndefined();
  });

  it('returns empty prose for blank input', () => {
    expect(parseDesignMd('')).toEqual({ sections: {} });
  });

  it('round-trips prose through generate → parse', () => {
    const prose = {
      name: 'My App',
      description: 'A small thing.',
      sections: {
        Overview: 'One.\nTwo.',
        "Do's and Don'ts": '**Do:** use tokens.',
      },
    };
    const parsed = parseDesignMd(generateDesignMd(SAMPLE, prose));
    expect(parsed.name).toBe('My App');
    expect(parsed.description).toBe('A small thing.');
    expect(parsed.sections['Overview']).toBe('One.\nTwo.');
    expect(parsed.sections["Do's and Don'ts"]).toBe('**Do:** use tokens.');
  });
});
