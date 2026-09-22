import { describe, it, expect } from 'vitest';
import { AGENT_MD_CONTENT, AGENT_MD_CONTENT_LEGACY, AGENT_MD_CONTENT_SCAMP, } from '@shared/agentMd';
/**
 * The guidance is the whole of what an agent knows before it writes a
 * line, and it is regenerated into every project on open — so a stale
 * sentence is shipped, not merely wrong in a repo. The scamp variant
 * used to be the Next.js template with two paragraphs replaced, which
 * left 34 Next.js references describing files that don't exist.
 * see docs/notes/agent-md-layouts.md
 */
/** Anything that only makes sense in a Next.js App Router project. */
const NEXT_ISMS = [
    ['the framework name', /Next\.js/],
    ['the dev command', /\bnext dev\b/],
    ['the build command', /\bnext build\b/],
    ['the config file', /next\.config/],
    ['the root layout', /app\/layout/],
    ['the token file path', /app\/theme\.css/],
    ['a page file path', /app\/[\w[\]-]*\/?page\.tsx/],
    ['a page CSS path', /page\.module\.css/],
    ['the link component', /next\/link/],
    ['the public dir rationale', /Next\.js serves/],
];
describe('AGENT_MD_CONTENT_SCAMP', () => {
    it.each(NEXT_ISMS)('never mentions %s', (_label, pattern) => {
        expect(AGENT_MD_CONTENT_SCAMP).not.toMatch(pattern);
    });
    it('mentions `app/` only to say there isn\'t one', () => {
        const lines = AGENT_MD_CONTENT_SCAMP.split('\n').filter((l) => l.includes('`app/'));
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines)
            expect(line).toMatch(/There is no/);
    });
    it('describes the framework layout it actually ships', () => {
        for (const path of [
            'views/<Name>/<Name>.tsx',
            'components/<Name>/<Name>.tsx',
            'design/theme.css',
            'design/DESIGN.md',
            'scamp.config.json',
            '.dev.vars',
            'routes/',
        ]) {
            expect(AGENT_MD_CONTENT_SCAMP).toContain(path);
        }
    });
    it('documents the route file, which is the part the agent owns outright', () => {
        // Four mentions of `routes/` and no example was the state that had
        // an agent inferring the shape from the runtime's types.
        expect(AGENT_MD_CONTENT_SCAMP).toContain('## Route files');
        expect(AGENT_MD_CONTENT_SCAMP).toContain('LoadContext');
        expect(AGENT_MD_CONTENT_SCAMP).toContain('RouteProps<typeof load>');
        expect(AGENT_MD_CONTENT_SCAMP).toContain("export const render = 'static';");
        expect(AGENT_MD_CONTENT_SCAMP).toMatch(/\[\.\.\.rest\]/);
    });
    it('says how a data-driven image binds, which is where a catalogue lands', () => {
        const assets = AGENT_MD_CONTENT_SCAMP.slice(AGENT_MD_CONTENT_SCAMP.indexOf('## Images and static assets'));
        expect(assets).toContain('src={product.image}');
        expect(assets).toContain('public/');
    });
    it('points verification at the tool that reports degradation', () => {
        // scamp_get_element_tree reports structure, so a view that lost a
        // binding still looks correct in it.
        expect(AGENT_MD_CONTENT_SCAMP).toContain('scamp_check_view');
    });
});
describe('AGENT_MD_CONTENT (Next.js)', () => {
    it('still describes the App Router layout for projects on it', () => {
        expect(AGENT_MD_CONTENT).toContain('Next.js App Router');
        expect(AGENT_MD_CONTENT).toContain('app/layout.tsx');
        expect(AGENT_MD_CONTENT).toContain('app/theme.css');
    });
    it('shares the conventions with the scamp variant rather than duplicating them', () => {
        // Both are built from one body; a rule written once applies to both.
        for (const shared of [
            '## Critical rules',
            '## CSS conventions',
            '## Responsive breakpoints',
            'data-scamp-id',
        ]) {
            expect(AGENT_MD_CONTENT).toContain(shared);
            expect(AGENT_MD_CONTENT_SCAMP).toContain(shared);
        }
    });
});
describe('every variant', () => {
    it('carries the managed-file warning so a hand edit is not a surprise', () => {
        for (const content of [AGENT_MD_CONTENT, AGENT_MD_CONTENT_SCAMP, AGENT_MD_CONTENT_LEGACY]) {
            expect(content.startsWith('<!-- This file is managed by Scamp')).toBe(true);
        }
    });
    it('leaves no unsubstituted vocabulary slot', () => {
        // `${...}` on its own is legitimate — the guidance is full of JSX
        // examples. A leftover slot is specifically `${v.something}`.
        for (const content of [AGENT_MD_CONTENT, AGENT_MD_CONTENT_SCAMP, AGENT_MD_CONTENT_LEGACY]) {
            expect(content).not.toMatch(/\$\{v\./);
            expect(content).not.toMatch(/\bundefined\b/);
        }
    });
});
