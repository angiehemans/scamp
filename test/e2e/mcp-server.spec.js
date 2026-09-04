import { promises as fs } from 'fs';
import { join } from 'path';
import { test, expect } from './fixtures/app';
import { dragInFrame, selectTool } from './fixtures/canvas';
import { pageRoot } from './fixtures/selectors';
/**
 * The MCP server, end to end in a real Electron session.
 *
 * This is the ONLY level that exercises the main↔renderer seam: unit and
 * integration tests cover each half, but nothing else proves a tool call
 * arriving over HTTP in main comes back with live canvas state from the
 * renderer's store. The test speaks the real protocol over the real socket,
 * exactly as an agent would.
 * see docs/plans/mcp-server-plan.md
 */
test.use({ projectOptions: { format: 'nextjs' } });
/** Wait for the server to advertise itself — startup races project open. */
const readConfig = async (projectPath) => {
    const path = join(projectPath, '.scamp', 'mcp.json');
    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            const parsed = JSON.parse(await fs.readFile(path, 'utf-8'));
            if (parsed.running && parsed.url && parsed.token)
                return parsed;
        }
        catch {
            // Not written yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`.scamp/mcp.json never reported a running server`);
};
const rpc = async (config, method, params) => {
    const res = await fetch(config.url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'x-scamp-token': config.token,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    return (await res.json());
};
/** Call a tool and return its text content, which is JSON for every tool. */
const callTool = async (config, name, args = {}) => {
    const body = await rpc(config, 'tools/call', { name, arguments: args });
    const result = body['result'];
    if (result === undefined)
        throw new Error(`no result: ${JSON.stringify(body)}`);
    return result.content[0]?.text ?? '';
};
test.describe('MCP server, live', () => {
    test('starts with the project and advertises itself in .scamp/', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        expect(config.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
        expect(config.token.length).toBeGreaterThan(10);
    });
    test('registers itself in .mcp.json so the user runs no command', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const written = JSON.parse(await fs.readFile(join(project.dir, '.mcp.json'), 'utf-8'));
        expect(written.mcpServers.scamp.url).toBe(config.url);
        expect(written.mcpServers.scamp.headers['X-Scamp-Token']).toBe(config.token);
    });
    test('gitignores the registration so the token is never committed', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await readConfig(project.dir);
        const gitignore = await fs.readFile(join(project.dir, '.gitignore'), 'utf-8');
        expect(gitignore).toContain('.mcp.json');
    });
    test('completes the handshake, carries instructions, and lists every tool', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const init = await rpc(config, 'initialize', { protocolVersion: '2025-06-18' });
        expect(init['result']).toMatchObject({
            capabilities: { tools: {} },
            serverInfo: { name: 'scamp' },
        });
        // The server-carried guidance — reaches an agent that skipped agent.md.
        expect(init['result'].instructions).toContain('components/');
        const list = await rpc(config, 'tools/list');
        const tools = list['result'].tools;
        expect(tools.map((t) => t.name).sort()).toEqual([
            'scamp_get_active_page',
            'scamp_get_canvas_state',
            'scamp_get_component_scaffold',
            'scamp_get_element_by_id',
            'scamp_get_element_tree',
            'scamp_get_selected_element',
            'scamp_get_theme_tokens',
            'scamp_list_components',
            'scamp_list_pages',
        ]);
    });
    test('answers from the live canvas, across the main↔renderer seam', async ({ window, project, }) => {
        // The whole point of the feature: draw something, select it, and have an
        // agent learn about it without the user describing anything.
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 60, y: 60 }, { x: 260, y: 200 });
        const config = await readConfig(project.dir);
        const text = await callTool(config, 'scamp_get_selected_element');
        const element = JSON.parse(text);
        expect(element.class).toMatch(/^rect_[0-9a-f]{4}$/);
        expect(element.tag).toBe('div');
        expect(element.styles).toBeDefined();
    });
    test('follows the selection rather than answering from a snapshot', async ({ window, project, }) => {
        // The case that decided pull-through over a cached snapshot: a stale
        // answer here would be confidently wrong, not visibly broken.
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 60, y: 60 }, { x: 160, y: 140 });
        const config = await readConfig(project.dir);
        const first = JSON.parse(await callTool(config, 'scamp_get_selected_element'));
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 220, y: 60 }, { x: 340, y: 160 });
        const second = JSON.parse(await callTool(config, 'scamp_get_selected_element'));
        expect(second.id).not.toBe(first.id);
    });
    test('reports the open page with project-relative paths', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const active = JSON.parse(await callTool(config, 'scamp_get_active_page'));
        expect(active.kind).toBe('page');
        // Absolute paths would leak the user's home directory into text the
        // agent quotes back.
        expect(active.tsx.startsWith('/')).toBe(false);
        expect(active.tsx).toContain('page.tsx');
    });
    test('returns the element tree for the open page', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        await selectTool(window, 'r');
        await dragInFrame(window, { x: 60, y: 60 }, { x: 200, y: 160 });
        const config = await readConfig(project.dir);
        const tree = JSON.parse(await callTool(config, 'scamp_get_element_tree'));
        expect(tree.root.children.length).toBeGreaterThan(0);
    });
    test('reports an unknown element id as isError, keeping the turn alive', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const text = await callTool(config, 'scamp_get_element_by_id', { id: 'zzzz' });
        expect(text).toContain('No element with that id');
    });
    test('rejects a request with no token', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const res = await fetch(config.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
        });
        expect(res.status).toBe(401);
    });
    test('rejects a request carrying a browser Origin', async ({ window, project }) => {
        await expect(pageRoot(window)).toBeVisible();
        const config = await readConfig(project.dir);
        const res = await fetch(config.url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-scamp-token': config.token,
                origin: 'https://evil.example',
            },
            body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
        });
        expect(res.status).toBe(403);
    });
    test('surfaces its status in the terminal panel, and whether an agent has connected', async ({ window, project, }) => {
        await expect(pageRoot(window)).toBeVisible();
        await window.keyboard.press('ControlOrMeta+`');
        const pill = window.locator('[data-testid="mcp-status"]');
        await expect(pill).toBeVisible();
        await expect(pill).toHaveAttribute('data-running', 'true');
        // One authenticated request is what turns "listening" into
        // "connected". The pill polls, so allow it a couple of cycles.
        const config = await readConfig(project.dir);
        await rpc(config, 'ping');
        await expect(pill).toHaveAttribute('data-agent', 'connected', { timeout: 10_000 });
    });
});
