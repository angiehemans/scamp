import { describe, it, expect } from 'vitest';
import { normalizeRecentProjectEntry } from '../src/shared/recentProjectNormalize';

describe('normalizeRecentProjectEntry', () => {
  it('passes through a fully-formed nextjs entry', () => {
    const entry = {
      name: 'my-project',
      path: '/Users/angie/dev/my-project',
      format: 'nextjs',
      lastOpened: '2026-04-30T10:00:00Z',
    };
    expect(normalizeRecentProjectEntry(entry)).toEqual(entry);
  });

  it('passes through a fully-formed legacy entry', () => {
    const entry = {
      name: 'old-thing',
      path: '/Users/angie/dev/old-thing',
      format: 'legacy',
      lastOpened: '2026-01-15T09:00:00Z',
    };
    expect(normalizeRecentProjectEntry(entry)).toEqual(entry);
  });

  it('backfills format=legacy when the field is missing', () => {
    // Pre-existing entries written before the format field shipped.
    const raw = {
      name: 'pre-update',
      path: '/Users/angie/dev/pre-update',
      lastOpened: '2026-04-01T09:00:00Z',
    };
    expect(normalizeRecentProjectEntry(raw)).toEqual({
      ...raw,
      format: 'legacy',
    });
  });

  it('backfills format=legacy when the field is an unknown value', () => {
    // Forward-compatibility: an old build seeing a future format value
    // shouldn't crash — fall back to the safer default.
    const raw = {
      name: 'future',
      path: '/Users/angie/dev/future',
      format: 'martian',
      lastOpened: '2026-04-01T09:00:00Z',
    };
    expect(normalizeRecentProjectEntry(raw)?.format).toBe('legacy');
  });

  it('returns null when the name field is missing', () => {
    expect(
      normalizeRecentProjectEntry({
        path: '/x',
        lastOpened: '2026-04-01T09:00:00Z',
      })
    ).toBeNull();
  });

  it('returns null when the path field is missing', () => {
    expect(
      normalizeRecentProjectEntry({
        name: 'x',
        lastOpened: '2026-04-01T09:00:00Z',
      })
    ).toBeNull();
  });

  it('returns null when lastOpened is missing', () => {
    expect(
      normalizeRecentProjectEntry({ name: 'x', path: '/x' })
    ).toBeNull();
  });

  it('returns null for non-object inputs', () => {
    expect(normalizeRecentProjectEntry(null)).toBeNull();
    expect(normalizeRecentProjectEntry(undefined)).toBeNull();
    expect(normalizeRecentProjectEntry('string')).toBeNull();
    expect(normalizeRecentProjectEntry(42)).toBeNull();
  });
});
