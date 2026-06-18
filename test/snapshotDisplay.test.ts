import { describe, it, expect } from 'vitest';

import {
  formatPageCount,
  snapshotsNewestFirst,
  triggerIcon,
} from '../src/renderer/store/snapshotDisplay';
import type { SnapshotMeta } from '../src/shared/types';

const meta = (over: Partial<SnapshotMeta>): SnapshotMeta => ({
  id: 'snap_x',
  timestamp: '2026-05-01T10:00:00.000Z',
  trigger: 'manual',
  label: 'x',
  pageCount: 1,
  ...over,
});

describe('triggerIcon', () => {
  it('maps each trigger to an icon family', () => {
    expect(triggerIcon('session_open')).toBe('session-open');
    expect(triggerIcon('session_close')).toBe('session-close');
    expect(triggerIcon('agent_edit')).toBe('agent');
    expect(triggerIcon('manual')).toBe('manual');
    expect(triggerIcon('auto_save')).toBe('auto');
    expect(triggerIcon('before_restore')).toBe('restore');
  });
});

describe('snapshotsNewestFirst', () => {
  it('reverses oldest-first storage into newest-first display', () => {
    const list = [meta({ id: 'a' }), meta({ id: 'b' }), meta({ id: 'c' })];
    expect(snapshotsNewestFirst(list).map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the input', () => {
    const list = [meta({ id: 'a' }), meta({ id: 'b' })];
    snapshotsNewestFirst(list);
    expect(list.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('formatPageCount', () => {
  it('pluralises', () => {
    expect(formatPageCount(1)).toBe('1 page');
    expect(formatPageCount(2)).toBe('2 pages');
    expect(formatPageCount(0)).toBe('0 pages');
  });
});
