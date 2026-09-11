import { describe, expect, it, vi } from 'vitest';

import { createToolInvoker, TOOL_DESCRIPTORS, TOOL_NAMES } from '../src/main/mcp/tools';

/**
 * The tool surface an agent sees. Descriptions and schemas are the only
 * thing telling it when to reach for each one, so they get asserted like
 * behaviour rather than treated as prose.
 * see docs/plans/mcp-server-plan.md
 */

const invoker = (data: unknown = { ok: true }) =>
  createToolInvoker(async () => data);

describe('TOOL_DESCRIPTORS', () => {
  it('exposes the eight canvas tools from the brief plus the component scaffold', () => {
    expect(TOOL_NAMES).toEqual([
      'scamp_get_active_page',
      'scamp_get_selected_element',
      'scamp_get_element_by_id',
      'scamp_get_element_tree',
      'scamp_get_canvas_state',
      'scamp_list_pages',
      'scamp_list_components',
      'scamp_get_component_scaffold',
      'scamp_get_theme_tokens',
    ]);
  });

  it('gives every tool a strict object schema', () => {
    // A hallucinated argument should fail at the boundary, not be ignored.
    for (const tool of TOOL_DESCRIPTORS) {
      expect(tool.inputSchema['type']).toBe('object');
      expect(tool.inputSchema['additionalProperties']).toBe(false);
    }
  });

  it('gives every tool a description that says when to use it', () => {
    for (const tool of TOOL_DESCRIPTORS) {
      expect(tool.description.length).toBeGreaterThan(40);
    }
  });

  it('requires an id on get_element_by_id, a name on get_component_scaffold, and nothing else', () => {
    const byId = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_get_element_by_id');
    expect(byId?.inputSchema['required']).toEqual(['id']);
    const scaffold = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_get_component_scaffold');
    expect(scaffold?.inputSchema['required']).toEqual(['name']);
    for (const tool of TOOL_DESCRIPTORS) {
      if (tool.name === 'scamp_get_element_by_id') continue;
      if (tool.name === 'scamp_get_component_scaffold') continue;
      expect(tool.inputSchema['required']).toBeUndefined();
    }
  });

  it('tells the agent to create components when list_components comes back empty', () => {
    // The observed failure: asked for "components", an agent built pages
    // of examples because nothing said the folder format existed.
    const tool = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_list_components');
    expect(tool?.description).toContain('scamp_get_component_scaffold');
    expect(tool?.description.toLowerCase()).toContain('create');
  });

  it('steers get_component_scaffold away from a page of examples', () => {
    const tool = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_get_component_scaffold');
    expect(tool?.description).toContain('components/');
    expect(tool?.description.toLowerCase()).toContain('rather than a page');
  });

  it('does not advertise variants on list_components', () => {
    // Variants aren't on main; promising the field would mislead the agent.
    const tool = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_list_components');
    expect(tool?.description.toLowerCase()).not.toContain('variant');
  });

  it('warns that get_canvas_state is large and capped', () => {
    const tool = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_get_canvas_state');
    expect(tool?.description).toMatch(/capped|truncated/i);
  });

  it('tells the agent get_active_page may return a component', () => {
    const tool = TOOL_DESCRIPTORS.find((t) => t.name === 'scamp_get_active_page');
    expect(tool?.description.toLowerCase()).toContain('component');
  });
});

describe('createToolInvoker', () => {
  it('serialises the answer as readable JSON', async () => {
    const out = await invoker({ id: 'a1b2', tag: 'div' })('scamp_get_selected_element', {});
    expect(out.content[0]?.text).toContain('"id": "a1b2"');
    expect(out.isError).toBeUndefined();
  });

  it('forwards the tool name and args to the query', async () => {
    const run = vi.fn(async () => null);
    await createToolInvoker(run)('scamp_get_element_by_id', { id: 'a1b2' });
    expect(run).toHaveBeenCalledWith('scamp_get_element_by_id', { id: 'a1b2' });
  });

  it('explains a null selection in words rather than printing "null"', async () => {
    // A bare `null` reads as a failure to a model; it actually means
    // "nothing is selected", which is a useful answer.
    const out = await invoker(null)('scamp_get_selected_element', {});
    expect(out.content[0]?.text).toContain('No element is currently selected');
    expect(out.isError).toBeUndefined();
  });

  it('explains a missing element for get_element_by_id', async () => {
    const out = await invoker(null)('scamp_get_element_by_id', { id: 'gone' });
    expect(out.content[0]?.text).toContain('No element with that id');
  });

  it('explains a closed project for get_active_page', async () => {
    const out = await invoker(null)('scamp_get_active_page', {});
    expect(out.content[0]?.text).toContain('No project is currently open');
  });

  it('rejects get_element_by_id with no id, without calling through', async () => {
    const run = vi.fn(async () => null);
    const out = await createToolInvoker(run)('scamp_get_element_by_id', {});
    expect(out.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects a non-string id', async () => {
    const out = await invoker()('scamp_get_element_by_id', { id: 42 });
    expect(out.isError).toBe(true);
  });

  it('rejects an empty-string id', async () => {
    const out = await invoker()('scamp_get_element_by_id', { id: '' });
    expect(out.isError).toBe(true);
  });

  it('turns a query failure into an isError result, not a throw', async () => {
    // The agent's turn must survive a timeout with something it can act on.
    const run = async (): Promise<unknown> => {
      throw new Error('The Scamp canvas did not respond in time.');
    };
    const out = await createToolInvoker(run)('scamp_get_selected_element', {});
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text).toContain('did not respond');
  });

  it('names the failing tool in the error text', async () => {
    const run = async (): Promise<unknown> => {
      throw new Error('boom');
    };
    const out = await createToolInvoker(run)('scamp_list_pages', {});
    expect(out.content[0]?.text).toContain('scamp_list_pages');
  });

  it('rejects a tool it does not own', async () => {
    const out = await invoker()('scamp_delete_everything', {});
    expect(out.isError).toBe(true);
  });

  it('handles an empty list without calling it an error', async () => {
    const out = await invoker([])('scamp_list_components', {});
    expect(out.isError).toBeUndefined();
    expect(out.content[0]?.text).toBe('[]');
  });

  describe('scamp_get_component_scaffold', () => {
    it('answers without a canvas round trip', async () => {
      const run = vi.fn(async () => null);
      const out = await createToolInvoker(run)('scamp_get_component_scaffold', {
        name: 'HeroCard',
      });
      expect(run).not.toHaveBeenCalled();
      expect(out.isError).toBeUndefined();
    });

    it('returns both files at their project-relative paths, CSS first', async () => {
      const out = await invoker()('scamp_get_component_scaffold', { name: 'HeroCard' });
      const parsed = JSON.parse(out.content[0]?.text ?? '') as {
        name: string;
        files: Array<{ path: string; content: string }>;
      };
      expect(parsed.name).toBe('HeroCard');
      expect(parsed.files.map((f) => f.path)).toEqual([
        'components/HeroCard/HeroCard.module.css',
        'components/HeroCard/HeroCard.tsx',
      ]);
      expect(parsed.files[1]?.content).toContain('export default function HeroCard(');
      expect(parsed.files[1]?.content).toContain('data-scamp-id="root"');
      expect(parsed.files[0]?.content).toContain('.root {');
    });

    it('rejects a name that is not PascalCase letters and digits', async () => {
      for (const name of ['hero-card', 'hero_card', 'heroCard', '', '1Card']) {
        const out = await invoker()('scamp_get_component_scaffold', { name });
        expect(out.isError, name).toBe(true);
        expect(out.content[0]?.text).toContain('PascalCase');
      }
    });

    it('rejects a missing or non-string name', async () => {
      expect((await invoker()('scamp_get_component_scaffold', {})).isError).toBe(true);
      expect(
        (await invoker()('scamp_get_component_scaffold', { name: 42 })).isError
      ).toBe(true);
    });
  });
});
