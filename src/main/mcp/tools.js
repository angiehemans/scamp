import { errorResult, textResult, } from './protocol';
/**
 * The eight canvas tools an agent can call.
 *
 * Descriptions are written FOR THE MODEL, not for a human reader — they are
 * the only thing telling it when a tool is the right one, so they say when to
 * reach for it rather than restating the name. Schemas are strict
 * (`additionalProperties: false`) so a hallucinated argument fails loudly at
 * the boundary instead of being silently ignored.
 * see docs/plans/mcp-server-plan.md
 */
/** Every tool takes no arguments except `get_element_by_id`. */
const NO_ARGS = {
    type: 'object',
    properties: {},
    additionalProperties: false,
};
export const TOOL_DESCRIPTORS = [
    {
        name: 'scamp_get_active_page',
        description: 'The page or component currently open on the Scamp canvas, with its project-relative TSX and CSS module paths. Call this first when you need to know which files the user is looking at. Note the result may be a component, not a page — check `kind`.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_selected_element',
        description: 'Full details of the element the user currently has selected: class, tag, parent, children, and its styles. Call this whenever the user says "this", "it", or "the selected element" instead of asking them to describe it. Returns null when nothing is selected.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_element_by_id',
        description: 'Full details of any element by its Scamp id, whether or not it is selected. Use this to follow up on ids returned by scamp_get_element_tree or scamp_get_canvas_state. Returns null if no such element exists.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The Scamp element id, e.g. "a1b2" (not the CSS class).',
                },
            },
            required: ['id'],
            additionalProperties: false,
        },
    },
    {
        name: 'scamp_get_element_tree',
        description: 'The full element tree for the open page or component — ids, classes, and tags only, no styles. This is the cheap way to understand structure; follow up with scamp_get_element_by_id for the details of specific elements.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_canvas_state',
        description: 'A broad snapshot: active target, selection, breakpoint, and every element with its styles. Large — prefer scamp_get_element_tree plus scamp_get_element_by_id unless you genuinely need everything at once. Element output is capped; a `truncated` field appears when it was.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_list_pages',
        description: 'Every page in the project with its project-relative TSX and CSS module paths. Use this to find a page the user names that is not the one currently open.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_list_components',
        description: 'Every reusable component in the project with its project-relative file paths. Read the returned .tsx file for a component’s props and markup.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_theme_tokens',
        description: 'The design tokens defined in the project’s theme.css, as a flat list of CSS custom properties, plus the available themes. Call this before writing any colour, spacing, or typography value so you use an existing token instead of a raw literal.',
        inputSchema: { ...NO_ARGS },
    },
];
/** Names the invoker will accept — derived so the two can never drift. */
export const TOOL_NAMES = TOOL_DESCRIPTORS.map((tool) => tool.name);
/**
 * Serialise a tool's answer.
 *
 * JSON in a text block rather than `structuredContent`: every MCP client
 * understands text, and the shapes here are small enough to read directly.
 * `null` becomes an explicit sentence because a bare "null" reads as a
 * failure to a model, when it actually means "nothing is selected".
 */
const format = (tool, data) => {
    if (data === null || data === undefined) {
        if (tool === 'scamp_get_selected_element') {
            return textResult('No element is currently selected on the Scamp canvas.');
        }
        if (tool === 'scamp_get_element_by_id') {
            return textResult('No element with that id exists on the open page.');
        }
        if (tool === 'scamp_get_active_page') {
            return textResult('No project is currently open in Scamp.');
        }
        return textResult('null');
    }
    return textResult(JSON.stringify(data, null, 2));
};
/**
 * Build the invoker the protocol layer calls.
 *
 * `runQuery` is injected — in the app it's the renderer round trip, in tests
 * it's a stub. Keeping the boundary here is what lets the whole tool surface
 * be tested without an Electron window.
 */
export const createToolInvoker = (runQuery) => {
    return async (name, args) => {
        if (!TOOL_NAMES.includes(name)) {
            // Defence in depth: `protocol.ts` already rejects unknown tools, but
            // this module must not depend on that having happened.
            return errorResult(`Unknown tool: ${name}`);
        }
        if (name === 'scamp_get_element_by_id') {
            const id = args['id'];
            if (typeof id !== 'string' || id.length === 0) {
                return errorResult('scamp_get_element_by_id requires a non-empty string "id" argument.');
            }
        }
        try {
            return format(name, await runQuery(name, args));
        }
        catch (err) {
            // Timeouts and renderer failures land here. An isError result keeps
            // the agent's turn alive and tells it what to do next.
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(`${name} failed: ${message}`);
        }
    };
};
