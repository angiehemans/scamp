import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileWriteAckPayload } from '@shared/types';
import { createPendingWriteTracker } from '../../src/main/pendingWrites';

const TSX = '/project/home.tsx';
const CSS = '/project/home.module.css';
const OTHER = '/project/other.tsx';

describe('save status — pending writes tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits an ack when the matching path is consumed', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    const result = tracker.consume(TSX);

    expect(result).toEqual({ suppressChanged: true });
    expect(sent).toEqual([{ writeId: 'write-1', path: TSX }]);
    expect(tracker.size()).toBe(0);
  });

  it('returns null and does not emit when an unrelated path is consumed', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    const result = tracker.consume(OTHER);

    expect(result).toBeNull();
    expect(sent).toEqual([]);
    expect(tracker.size()).toBe(1);
  });

  it('emits one ack per registered sibling path when both consumed in order', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    tracker.register(CSS, 'write-1', true);

    tracker.consume(TSX);
    tracker.consume(CSS);

    expect(sent).toEqual([
      { writeId: 'write-1', path: TSX },
      { writeId: 'write-1', path: CSS },
    ]);
  });

  it('emits sibling acks regardless of arrival order', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    tracker.register(CSS, 'write-1', true);

    tracker.consume(CSS);
    tracker.consume(TSX);

    expect(new Set(sent.map((p) => p.path))).toEqual(new Set([TSX, CSS]));
    expect(sent.every((p) => p.writeId === 'write-1')).toBe(true);
  });

  it('fires the watchdog ack on expiry when chokidar never consumes the path', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    expect(sent).toEqual([]);

    vi.advanceTimersByTime(399);
    expect(sent).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(sent).toEqual([{ writeId: 'write-1', path: TSX }]);
    expect(tracker.size()).toBe(0);
  });

  it('does not fire the watchdog after cancel', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    tracker.cancel(TSX);

    vi.advanceTimersByTime(1000);
    expect(sent).toEqual([]);
    expect(tracker.size()).toBe(0);
  });

  it('preserves suppressChanged=false for patch writes', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(CSS, 'patch-1', false);
    const result = tracker.consume(CSS);

    expect(result).toEqual({ suppressChanged: false });
    expect(sent).toEqual([{ writeId: 'patch-1', path: CSS }]);
  });

  it('overwrites an earlier pending write when the same path re-registers', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    tracker.register(TSX, 'write-2', true);

    // Only the newer writeId should ever surface.
    tracker.consume(TSX);
    vi.advanceTimersByTime(1000);

    expect(sent).toEqual([{ writeId: 'write-2', path: TSX }]);
  });

  it('isolates concurrent writes keyed by different paths', () => {
    const sent: FileWriteAckPayload[] = [];
    const tracker = createPendingWriteTracker((p) => sent.push(p), 400);

    tracker.register(TSX, 'write-1', true);
    tracker.register(CSS, 'write-2', false);

    tracker.consume(TSX);
    expect(sent).toEqual([{ writeId: 'write-1', path: TSX }]);

    tracker.consume(CSS);
    expect(sent).toEqual([
      { writeId: 'write-1', path: TSX },
      { writeId: 'write-2', path: CSS },
    ]);
  });
});
