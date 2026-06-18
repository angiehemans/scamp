import { describe, it, expect } from 'vitest';
import type { RecentProject } from '@shared/types';

import {
  parseRecentStore,
  upsertRecent,
  setRecentFormat,
  removeRecentByPath,
} from '../src/main/ipc/recentProjectsOps';

const entry = (path: string, over: Partial<RecentProject> = {}): RecentProject => ({
  name: path.split('/').pop() ?? path,
  path,
  format: 'nextjs',
  lastOpened: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('parseRecentStore', () => {
  it('returns [] for an object without recentProjects', () => {
    expect(parseRecentStore('{}')).toEqual([]);
  });

  it('returns [] when recentProjects is not an array', () => {
    expect(parseRecentStore('{"recentProjects": 5}')).toEqual([]);
  });

  it('drops malformed entries and keeps valid ones', () => {
    const raw = JSON.stringify({
      recentProjects: [entry('/a'), { junk: true }, null, entry('/b')],
    });
    expect(parseRecentStore(raw).map((p) => p.path)).toEqual(['/a', '/b']);
  });
});

describe('upsertRecent', () => {
  it('prepends a new entry', () => {
    expect(upsertRecent([entry('/a')], entry('/b')).map((p) => p.path)).toEqual([
      '/b',
      '/a',
    ]);
  });

  it('dedupes by path, moving the re-opened project to the front', () => {
    const list = [entry('/a'), entry('/b'), entry('/c')];
    expect(upsertRecent(list, entry('/b')).map((p) => p.path)).toEqual([
      '/b',
      '/a',
      '/c',
    ]);
  });

  it('caps the list at max', () => {
    const list = [entry('/a'), entry('/b'), entry('/c')];
    expect(upsertRecent(list, entry('/d'), 2).map((p) => p.path)).toEqual([
      '/d',
      '/a',
    ]);
  });
});

describe('setRecentFormat', () => {
  it('updates only the matching entry', () => {
    const list = [entry('/a', { format: 'nextjs' }), entry('/b', { format: 'nextjs' })];
    const next = setRecentFormat(list, '/a', 'legacy');
    expect(next.find((p) => p.path === '/a')?.format).toBe('legacy');
    expect(next.find((p) => p.path === '/b')?.format).toBe('nextjs');
  });
});

describe('removeRecentByPath', () => {
  it('drops the entry at the given path', () => {
    expect(
      removeRecentByPath([entry('/a'), entry('/b')], '/a').map((p) => p.path)
    ).toEqual(['/b']);
  });
});
