import type { SampleValue } from './element';
import type { ViewProp } from './viewProps';

/**
 * Generate route: the `routes/<slug>.tsx` that renders a view with its
 * own sample data. The view's props type is the contract a `load()`
 * must satisfy, so the generated `load()` returns the samples, typed by
 * inference, and the developer or agent replaces them with real data.
 * Pure. see docs/notes/routes-in-the-app.md
 */

export type GenerateRouteInput = {
  viewName: string;
  /** The route slug: `home` maps to `/`, anything else to `/<slug>`. */
  slug: string;
  props: ReadonlyArray<ViewProp>;
  /** A Drizzle recipe is present (`lib/db.ts`): add the commented query. */
  hasDatabase: boolean;
};

/** The route file for a slug, relative to `routes/`. */
export const routeFileForSlug = (slug: string): string =>
  slug === 'home' ? 'index.tsx' : `${slug}.tsx`;

const formatSample = (value: SampleValue, indent: string): string => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  if (value.length === 0) return '[]';
  const rows = value.map(
    (row) =>
      `${indent}  { ${Object.entries(row)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? String(v) : JSON.stringify(v)}`)
        .join(', ')} },`
  );
  return `[\n${rows.join('\n')}\n${indent}]`;
};

export const generateRouteTsx = (input: GenerateRouteInput): string => {
  const { viewName, props } = input;
  const data = props.filter((p) => p.kind !== 'event' && p.kind !== 'slot' && p.defaultValue !== undefined);
  const events = props.filter((p) => p.kind === 'event');
  // A view with event props needs the route in the browser to call them.
  const render = events.length > 0 ? 'client' : 'static';
  const lines: string[] = [];
  if (data.length > 0) lines.push("import type { LoadContext, RouteProps } from 'scampjs/runtime';");
  lines.push(`import ${viewName} from '@/views/${viewName}/${viewName}';`);
  if (input.hasDatabase && data.length > 0) {
    lines.push("// import { db } from '@/lib/db';");
    lines.push("// import { items } from '@/db/schema';");
  }
  lines.push('', `export const render = '${render}';`, '');
  if (data.length > 0) {
    lines.push(
      `export async function load(${input.hasDatabase ? '{ env }' : '_ctx'}: LoadContext) {`,
      `  // Sample data from the ${viewName} view. Replace it with real data;`,
      "  // the shape is the view's props, and this is the only place that",
      '  // computes it. See agent.md.'
    );
    if (input.hasDatabase) {
      lines.push('  // const rows = await db(env).select().from(items);');
    }
    lines.push('  return {');
    for (const p of data) {
      lines.push(`    ${p.name}: ${formatSample(p.defaultValue as SampleValue, '    ')},`);
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
  } else {
    lines.push('  return (', `    <${viewName}`);
    for (const attr of attrs) lines.push(`      ${attr}`);
    lines.push('    />', '  );');
  }
  lines.push('}', '');
  return lines.join('\n');
};
