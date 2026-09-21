import { errorResult, textResult, } from './protocol';
import { COMPONENT_NAME_RE, DEFAULT_COMPONENT_CSS, componentRelativePaths, defaultComponentTsx, } from '../ipc/componentScaffold';
/**
 * The canvas tools an agent can call.
 *
 * Descriptions are written FOR THE MODEL, not for a human reader — they are
 * the only thing telling it when a tool is the right one, so they say when to
 * reach for it rather than restating the name. Schemas are strict
 * (`additionalProperties: false`) so a hallucinated argument fails loudly at
 * the boundary instead of being silently ignored.
 * see docs/plans/mcp-server-plan.md
 */
/** Every tool takes no arguments except `get_element_by_id`,
 *  `get_component_scaffold`, and `get_view_props`. */
const NO_ARGS = {
    type: 'object',
    properties: {},
    additionalProperties: false,
};
export const TOOL_DESCRIPTORS = [
    {
        name: 'scamp_get_active_page',
        description: 'The page, component, or view currently open on the Scamp canvas, with its project-relative TSX and CSS module paths. Call this first when you need to know which files the user is looking at. Check `kind`: `component` and `view` files carry a props type and end with the `_scamp` export.',
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
        description: 'Every page in the project by route slug, with its project-relative file paths. Check `kind`: a `page` is a legacy app/<slug>/page.tsx; a `view` is the new shape — its design lives at views/<Name>/<Name>.tsx (`view` is that name) and the app/ file is a one-line wrapper Scamp owns. Edit the view, never the wrapper.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_list_components',
        description: 'Every reusable Scamp component in the project (`components/<Name>/`) with its project-relative file paths. Read the returned .tsx file for a component’s props and markup. If this is empty and the user asks for components, a kit, or a library, create them — call scamp_get_component_scaffold for the starter files rather than building a page of examples.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_component_scaffold',
        description: 'The exact starter TSX and CSS module for a new Scamp component, plus the project-relative paths to write them to. Call this before creating a component: when the user asks for components, a kit, or a library, write these folders under components/ rather than a page of examples. Scamp lists the component the moment the files exist. The name must be PascalCase letters and digits, e.g. "HeroCard".',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'PascalCase component name, e.g. "Card" or "HeroCard".',
                },
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'scamp_get_view_props',
        description: 'The props a view or component accepts: the exact `<Name>Props` type as its file declares it, each prop’s kind (text, attribute, boolean, repeat, show, event, slot), the event names `_scamp.events` lists, and the sample data the design renders with. Call this before writing the route or page that renders a view so the object you pass matches exactly — the sample rows show the shape of a repeat’s list. Takes the PascalCase name from scamp_list_pages (`view`) or scamp_list_components; a page’s route slug also works.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The view or component name, e.g. "Lobby", or a view page’s route slug, e.g. "lobby".',
                },
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'scamp_check_view',
        description: 'What a view or component LOST on the way into Scamp: bindings kept as opaque text, declarations that render but leave the panel controls blank, tokens theme.css does not declare, loose text that is not an editable element, sample rows that disagree. Call this after writing or editing a view — a file can parse perfectly and still arrive degraded, and scamp_get_element_tree reports structure, so it looks correct in every one of those cases. An empty `findings` list means the view arrived intact. Takes the same names as scamp_get_view_props.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The view or component name, e.g. "Lobby", or a view page\u2019s route slug, e.g. "lobby".',
                },
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'scamp_list_routes',
        description: 'Every file under routes/ in a Scamp-framework project: page routes with their URL pattern, render mode, and the view they render, and API routes (routes/api/**) with their URL. Call this before writing or editing a route, or to find which route renders a view; then read the file. Empty for a Next.js or legacy project.',
        inputSchema: { ...NO_ARGS },
    },
    {
        name: 'scamp_get_recent_edits',
        description: 'What the designer has changed in Scamp, newest last: one entry per save, with the file, the line each change starts at, and the text that replaced what was there. Call it after the user says they changed something, or before editing a file you read earlier, so you work from what is on disk now. Pass the `revision` from a previous call as `since` to get only what happened after it; omit it for everything this session.',
        inputSchema: {
            type: 'object',
            properties: {
                since: {
                    type: 'number',
                    description: 'A `revision` from an earlier call. Only later saves are returned.',
                },
            },
            additionalProperties: false,
        },
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
const format = (tool, data, args) => {
    if (data === null || data === undefined) {
        if (tool === 'scamp_get_view_props' || tool === 'scamp_check_view') {
            return textResult(`No view or component named "${String(args['name'] ?? '')}" exists. Call scamp_list_pages (the \`view\` field) or scamp_list_components for the names.`);
        }
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
const componentScaffoldResult = (name) => {
    if (typeof name !== 'string' || !COMPONENT_NAME_RE.test(name)) {
        return errorResult('scamp_get_component_scaffold requires a PascalCase "name" of letters and digits only, e.g. "HeroCard".');
    }
    const paths = componentRelativePaths(name);
    return textResult(JSON.stringify({
        name,
        files: [
            { path: paths.css, content: DEFAULT_COMPONENT_CSS },
            { path: paths.tsx, content: defaultComponentTsx(name) },
        ],
        note: 'Write both files (CSS first). Scamp lists the component in its sidebar as soon as they exist; no registration is needed. Then add elements inside the root exactly as you would on a page.',
    }, null, 2));
};
export const createToolInvoker = (runQuery, options = {}) => {
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
        if (name === 'scamp_get_view_props' || name === 'scamp_check_view') {
            const viewName = args['name'];
            if (typeof viewName !== 'string' || viewName.length === 0) {
                return errorResult(`${name} requires a non-empty string "name" argument — a view or component name such as "Lobby".`);
            }
        }
        // Answered here, not by the renderer: the scaffold is a pure
        // function of the name and needs no canvas state.
        if (name === 'scamp_get_component_scaffold') {
            return componentScaffoldResult(args['name']);
        }
        // Routes live on disk, not on the canvas.
        if (name === 'scamp_list_routes') {
            if (options.listRoutes === undefined)
                return textResult('[]');
            try {
                return textResult(JSON.stringify(await options.listRoutes(), null, 2));
            }
            catch (err) {
                return errorResult(`scamp_list_routes failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        try {
            return format(name, await runQuery(name, args), args);
        }
        catch (err) {
            // Timeouts and renderer failures land here. An isError result keeps
            // the agent's turn alive and tells it what to do next.
            const message = err instanceof Error ? err.message : String(err);
            return errorResult(`${name} failed: ${message}`);
        }
    };
};
