/** The route file for a slug, relative to `routes/`. */
export const routeFileForSlug = (slug) => slug === 'home' ? 'index.tsx' : `${slug}.tsx`;
const formatSample = (value, indent) => {
    if (typeof value === 'string')
        return JSON.stringify(value);
    if (typeof value === 'boolean')
        return String(value);
    if (value.length === 0)
        return '[]';
    const rows = value.map((row) => `${indent}  { ${Object.entries(row)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? String(v) : JSON.stringify(v)}`)
        .join(', ')} },`);
    return `[\n${rows.join('\n')}\n${indent}]`;
};
export const generateRouteTsx = (input) => {
    const { viewName, props } = input;
    const data = props.filter((p) => p.kind !== 'event' && p.kind !== 'slot' && p.defaultValue !== undefined);
    const events = props.filter((p) => p.kind === 'event');
    // A view with event props needs the route in the browser to call them.
    const render = events.length > 0 ? 'client' : 'static';
    const lines = [];
    if (data.length > 0)
        lines.push("import type { LoadContext, RouteProps } from 'scampjs/runtime';");
    lines.push(`import ${viewName} from '@/views/${viewName}/${viewName}';`);
    if (input.hasDatabase && data.length > 0) {
        lines.push("// import { db } from '@/lib/db';");
        lines.push("// import { items } from '@/db/schema';");
    }
    lines.push('', `export const render = '${render}';`, '');
    if (data.length > 0) {
        lines.push(`export async function load(${input.hasDatabase ? '{ env }' : '_ctx'}: LoadContext) {`, `  // Sample data from the ${viewName} view. Replace it with real data;`, "  // the shape is the view's props, and this is the only place that", '  // computes it. See agent.md.');
        if (input.hasDatabase) {
            lines.push('  // const rows = await db(env).select().from(items);');
        }
        lines.push('  return {');
        for (const p of data) {
            lines.push(`    ${p.name}: ${formatSample(p.defaultValue, '    ')},`);
        }
        lines.push('  };', '}', '');
    }
    const signature = data.length > 0 ? `{ data }: RouteProps<typeof load>` : '';
    lines.push(`export default function ${viewName}Route(${signature}) {`);
    const attrs = [
        ...data.map((p) => `${p.name}={data.${p.name}}`),
        ...events.map((p) => `${p.name}={() => {}}`),
    ];
    if (attrs.length === 0) {
        lines.push(`  return <${viewName} />;`);
    }
    else {
        lines.push('  return (', `    <${viewName}`);
        for (const attr of attrs)
            lines.push(`      ${attr}`);
        lines.push('    />', '  );');
    }
    lines.push('}', '');
    return lines.join('\n');
};
