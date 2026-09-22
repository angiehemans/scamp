import { describe, it, expect } from 'vitest';

import {
  AGENT_MD_CONTENT,
  AGENT_MD_CONTENT_LEGACY,
  AGENT_MD_CONTENT_SCAMP,
  findGuidanceSection,
  guidanceFor,
  guidanceSections,
  guidanceSectionTitles,
  guidanceSummary,
} from '@shared/agentMd';

/**
 * Slicing the guidance so an agent can be handed the part it needs.
 * The splitter runs over real 1400-line documents full of fenced code,
 * so the fence handling is the part that matters.
 * see docs/notes/agent-md-layouts.md
 */

const MD = [
  'Intro prose before any heading.',
  '',
  '## TL;DR',
  '',
  '- Edit CSS first.',
  '',
  '## HTML tags',
  '',
  'Use semantic HTML.',
  '',
  '### Tag-specific attributes',
  '',
  'Scamp preserves every attribute.',
  '',
  '## CSS properties',
  '',
  '```css',
  '/* not a heading: */',
  '## still inside the fence',
  '```',
  '',
  'After the fence.',
].join('\n');

describe('guidanceSections', () => {
  it('splits on top-level headings and keeps them in document order', () => {
    expect(guidanceSectionTitles(MD)).toEqual(['TL;DR', 'HTML tags', 'CSS properties']);
  });

  it('keeps a `###` subsection inside its parent', () => {
    const tags = guidanceSections(MD).find((s) => s.title === 'HTML tags');
    expect(tags?.body).toContain('### Tag-specific attributes');
    expect(tags?.body).toContain('Scamp preserves every attribute.');
  });

  it('ignores a `##` line inside a fenced code block', () => {
    const css = guidanceSections(MD).find((s) => s.title === 'CSS properties');
    expect(css?.body).toContain('## still inside the fence');
    expect(css?.body).toContain('After the fence.');
  });

  it('drops the prose before the first heading', () => {
    expect(guidanceSections(MD).some((s) => s.body.includes('Intro prose'))).toBe(false);
  });

  it('returns nothing for a document with no headings', () => {
    expect(guidanceSections('Just prose.\n\nMore prose.')).toEqual([]);
  });

  it('returns nothing for an empty document', () => {
    expect(guidanceSections('')).toEqual([]);
  });

  it('gives an empty body to a heading with nothing under it', () => {
    expect(guidanceSections('## Empty')).toEqual([{ title: 'Empty', body: '' }]);
  });
});

describe('findGuidanceSection', () => {
  it('matches an exact title', () => {
    expect(findGuidanceSection(MD, 'HTML tags')?.title).toBe('HTML tags');
  });

  it('ignores case and punctuation, so a name from memory still lands', () => {
    expect(findGuidanceSection(MD, 'html-tags')?.title).toBe('HTML tags');
    expect(findGuidanceSection(MD, 'HTML TAGS')?.title).toBe('HTML tags');
    expect(findGuidanceSection(MD, 'tldr')?.title).toBe('TL;DR');
  });

  it('matches on a prefix and on a substring', () => {
    expect(findGuidanceSection(MD, 'css')?.title).toBe('CSS properties');
    expect(findGuidanceSection(MD, 'properties')?.title).toBe('CSS properties');
  });

  it('returns null for a name that matches nothing', () => {
    expect(findGuidanceSection(MD, 'animations')).toBeNull();
  });

  it('returns null for an empty name rather than the first section', () => {
    expect(findGuidanceSection(MD, '')).toBeNull();
    expect(findGuidanceSection(MD, '   ')).toBeNull();
  });

  it('prefers the exact title over a section that merely contains it', () => {
    const md = '## Tags\n\nShort.\n\n## HTML tags\n\nLong.';
    expect(findGuidanceSection(md, 'Tags')?.body).toBe('Short.');
  });
});

describe('guidanceSummary', () => {
  it('returns the TL;DR body', () => {
    expect(guidanceSummary(MD)).toBe('- Edit CSS first.');
  });

  it('falls back to the leading prose when there is no TL;DR', () => {
    expect(guidanceSummary('Lead paragraph.\n\n## Other\n\nBody.')).toBe('Lead paragraph.');
  });

  it('returns the whole document when it has no headings at all', () => {
    expect(guidanceSummary('Only prose.')).toBe('Only prose.');
  });
});

describe('guidanceFor', () => {
  it('serves each project format its own guidance', () => {
    expect(guidanceFor('scamp')).toBe(AGENT_MD_CONTENT_SCAMP);
    expect(guidanceFor('nextjs')).toBe(AGENT_MD_CONTENT);
    expect(guidanceFor('legacy')).toBe(AGENT_MD_CONTENT_LEGACY);
  });
});

describe('against the real guidance', () => {
  it('finds the sections an agent is most likely to ask for', () => {
    for (const name of [
      'TL;DR',
      'Critical rules',
      'Route files',
      'HTML tags',
      'CSS conventions',
      'Images and static assets',
      'Responsive breakpoints',
    ]) {
      const section = findGuidanceSection(AGENT_MD_CONTENT_SCAMP, name);
      expect(section, `expected to find "${name}"`).not.toBeNull();
      expect(section?.body.length).toBeGreaterThan(0);
    }
  });

  it('has no `##` line from inside a code fence among the titles', () => {
    // The guidance is full of fenced CSS whose comments start with `/*`
    // and shell blocks — a mis-split shows up as a nonsense title.
    for (const title of guidanceSectionTitles(AGENT_MD_CONTENT_SCAMP)) {
      expect(title.length).toBeGreaterThan(2);
      expect(title.length).toBeLessThan(60);
      expect(title).not.toContain('{');
      expect(title).not.toMatch(/^[/*-]/);
    }
  });

  it('summarises to something far shorter than the whole document', () => {
    // The point of the tool: the summary has to be worth reading
    // instead of the file, not a rounding error smaller.
    const summary = guidanceSummary(AGENT_MD_CONTENT_SCAMP);
    expect(summary.length).toBeGreaterThan(200);
    expect(summary.length).toBeLessThan(AGENT_MD_CONTENT_SCAMP.length / 10);
  });

  it('covers the whole document between its sections', () => {
    // Nothing should fall between two headings and get lost.
    const sections = guidanceSections(AGENT_MD_CONTENT_SCAMP);
    const total = sections.reduce((n, s) => n + s.body.length, 0);
    expect(total).toBeGreaterThan(AGENT_MD_CONTENT_SCAMP.length * 0.9);
  });
});
