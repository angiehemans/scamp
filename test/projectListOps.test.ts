import { describe, it, expect } from 'vitest';
import type { RecentProject, ScannedProject } from '@shared/types';

import { mergeProjectsForDisplay } from '../src/main/ipc/projectListOps';

const recent = (
  path: string,
  lastOpened: string,
  over: Partial<RecentProject & { exists: boolean }> = {}
): RecentProject & { exists: boolean } => ({
  name: path.split('/').pop() ?? path,
  path,
  format: 'nextjs',
  lastOpened,
  exists: true,
  ...over,
});

const scanned = (path: string, over: Partial<ScannedProject> = {}): ScannedProject => ({
  name: path.split('/').pop() ?? path,
  path,
  format: 'nextjs',
  ...over,
});

describe('mergeProjectsForDisplay', () => {
  it('returns an empty list when there are no recents and nothing scanned', () => {
    expect(mergeProjectsForDisplay([], [])).toEqual([]);
  });

  it('lists scanned projects that were never opened with a null timestamp', () => {
    const result = mergeProjectsForDisplay([], [scanned('/projects/alpha')]);
    expect(result).toEqual([
      {
        name: 'alpha',
        path: '/projects/alpha',
        format: 'nextjs',
        lastOpened: null,
        exists: true,
      },
    ]);
  });

  it('overlays the recents timestamp onto a matching scanned project', () => {
    const result = mergeProjectsForDisplay(
      [recent('/projects/alpha', '2026-06-01T00:00:00.000Z')],
      [scanned('/projects/alpha')]
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: '/projects/alpha',
      lastOpened: '2026-06-01T00:00:00.000Z',
      exists: true,
    });
  });

  it('includes recents that the scan did not surface (opened from elsewhere)', () => {
    const result = mergeProjectsForDisplay(
      [recent('/elsewhere/beta', '2026-06-02T00:00:00.000Z')],
      [scanned('/projects/alpha')]
    );
    expect(result.map((p) => p.path)).toEqual([
      '/elsewhere/beta',
      '/projects/alpha',
    ]);
  });

  it('sorts opened projects most-recent-first, ahead of never-opened ones', () => {
    const result = mergeProjectsForDisplay(
      [
        recent('/projects/alpha', '2026-06-01T00:00:00.000Z'),
        recent('/projects/charlie', '2026-06-05T00:00:00.000Z'),
      ],
      [scanned('/projects/alpha'), scanned('/projects/charlie'), scanned('/projects/zulu')]
    );
    expect(result.map((p) => p.path)).toEqual([
      '/projects/charlie', // opened most recently
      '/projects/alpha', // opened earlier
      '/projects/zulu', // never opened — alphabetical, last
    ]);
  });

  it('sorts never-opened projects alphabetically by name', () => {
    const result = mergeProjectsForDisplay(
      [],
      [scanned('/p/delta'), scanned('/p/bravo'), scanned('/p/charlie')]
    );
    expect(result.map((p) => p.name)).toEqual(['bravo', 'charlie', 'delta']);
  });

  it('dedupes by path, preferring the freshly-scanned format', () => {
    const result = mergeProjectsForDisplay(
      [recent('/projects/alpha', '2026-06-01T00:00:00.000Z', { format: 'legacy' })],
      [scanned('/projects/alpha', { format: 'nextjs' })]
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.format).toBe('nextjs');
  });

  it('carries a stale recent (missing folder) through with exists=false', () => {
    const result = mergeProjectsForDisplay(
      [recent('/gone/ghost', '2026-06-03T00:00:00.000Z', { exists: false })],
      []
    );
    expect(result[0]).toMatchObject({ path: '/gone/ghost', exists: false });
  });
});
