import { describe, it, expect } from 'vitest';

import { generateRouteTsx, routeFileForSlug } from '@lib/generateRoute';
import type { ViewProp } from '@lib/viewProps';

/**
 * Generate route writes a route whose load() returns the view's sample
 * data, shaped by the view's props. see docs/notes/routes-in-the-app.md
 */
const lobbyProps: ViewProp[] = [
  { name: 'code', kind: 'text', tsType: 'string', defaultValue: 'KZQ4' },
  {
    name: 'players',
    kind: 'repeat',
    tsType: 'Array<{ id: string; label: string; seat: number }>',
    defaultValue: [
      { id: '1', label: 'Alex', seat: 1 },
      { id: '2', label: 'Bea', seat: 2 },
    ],
  },
  { name: 'waiting', kind: 'show', tsType: 'boolean', defaultValue: true },
  { name: 'onStart', kind: 'event', tsType: '() => void' },
];

describe('routeFileForSlug', () => {
  it('maps home to the index route and other slugs to their file', () => {
    expect(routeFileForSlug('home')).toBe('index.tsx');
    expect(routeFileForSlug('about-us')).toBe('about-us.tsx');
  });
});

describe('generateRouteTsx', () => {
  it('returns the samples from load() and renders the view with them, client when a view has events', () => {
    expect(generateRouteTsx({ viewName: 'Lobby', slug: 'lobby', props: lobbyProps, hasDatabase: false })).toBe(
      `import type { LoadContext, RouteProps } from 'scampjs/runtime';
import Lobby from '@/views/Lobby/Lobby';

export const render = 'client';

export async function load(_ctx: LoadContext) {
  // Sample data from the Lobby view. Replace it with real data;
  // the shape is the view's props, and this is the only place that
  // computes it. See agent.md.
  return {
    code: "KZQ4",
    players: [
      { id: "1", label: "Alex", seat: 1 },
      { id: "2", label: "Bea", seat: 2 },
    ],
    waiting: true,
  };
}

export default function LobbyRoute({ data }: RouteProps<typeof load>) {
  return (
    <Lobby
      code={data.code}
      players={data.players}
      waiting={data.waiting}
      onStart={() => {}}
    />
  );
}
`
    );
  });

  it('writes the simplest static route for a view with no props', () => {
    expect(generateRouteTsx({ viewName: 'Home', slug: 'home', props: [], hasDatabase: false })).toBe(
      `import Home from '@/views/Home/Home';

export const render = 'static';

export default function HomeRoute() {
  return <Home />;
}
`
    );
  });

  it('adds the commented Drizzle query when the project has a database', () => {
    const tsx = generateRouteTsx({
      viewName: 'Home',
      slug: 'home',
      props: [{ name: 'title', kind: 'text', tsType: 'string', defaultValue: 'Hi' }],
      hasDatabase: true,
    });
    expect(tsx).toContain("// import { db } from '@/lib/db';");
    expect(tsx).toContain('export async function load({ env }: LoadContext) {');
    expect(tsx).toContain('  // const rows = await db(env).select().from(items);');
    expect(tsx).toContain("export const render = 'static';");
  });

  it('leaves slots out: a route passes data and handlers, not markup', () => {
    const tsx = generateRouteTsx({
      viewName: 'Card',
      slug: 'card',
      props: [{ name: 'children', kind: 'slot', tsType: 'React.ReactNode' }],
      hasDatabase: false,
    });
    expect(tsx).toContain('  return <Card />;');
    expect(tsx).not.toContain('children');
  });
});
