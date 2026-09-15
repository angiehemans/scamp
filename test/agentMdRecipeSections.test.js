import { describe, it, expect } from 'vitest';
import { AGENT_MD_CONTENT_SCAMP, recipeSectionsOf, withRecipeSections } from '@shared/agentMd';
/**
 * The app regenerates agent.md on every open; a section the framework's
 * recipe runner appended must survive. see docs/notes/routes-in-the-app.md
 */
describe('recipeSectionsOf', () => {
    it('returns everything from the first recipe marker on', () => {
        const md = 'managed text\n\n<!-- scamp:recipe:drizzle -->\n## Database\n\nUse db(env).\n';
        expect(recipeSectionsOf(md)).toBe('<!-- scamp:recipe:drizzle -->\n## Database\n\nUse db(env).\n');
    });
    it('is empty without a marker', () => {
        expect(recipeSectionsOf('# Plain\n')).toBe('');
    });
});
describe('withRecipeSections', () => {
    it('appends the existing recipe sections after the template', () => {
        const existing = `${AGENT_MD_CONTENT_SCAMP}\n<!-- scamp:recipe:drizzle -->\n## Database\n\nUse db(env).\n`;
        const next = withRecipeSections('# New template\n', existing);
        expect(next).toBe('# New template\n\n<!-- scamp:recipe:drizzle -->\n## Database\n\nUse db(env).\n');
    });
    it('leaves the template alone when there is no existing file or no sections', () => {
        expect(withRecipeSections('# T\n', null)).toBe('# T\n');
        expect(withRecipeSections('# T\n', '# old, no recipes\n')).toBe('# T\n');
    });
    it('is stable: regenerating twice keeps one copy of the section', () => {
        const once = withRecipeSections('# T\n', '# old\n<!-- scamp:recipe:drizzle -->\n## Database\n');
        expect(withRecipeSections('# T\n', once)).toBe(once);
    });
});
describe('the scamp agent.md', () => {
    it('describes routes/api, .dev.vars, Generate route, and the routes tool', () => {
        expect(AGENT_MD_CONTENT_SCAMP).toContain('routes/api/');
        expect(AGENT_MD_CONTENT_SCAMP).toContain('.dev.vars');
        expect(AGENT_MD_CONTENT_SCAMP).toContain('Generate route');
        expect(AGENT_MD_CONTENT_SCAMP).toContain('scamp_list_routes');
    });
});
