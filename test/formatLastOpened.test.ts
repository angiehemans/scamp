import { describe, it, expect } from 'vitest';

import { formatLastOpened } from '../src/renderer/lib/formatLastOpened';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A fixed "now" so every case is deterministic: 1 Jul 2026, 12:00 UTC. */
const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

/** `NOW` minus a span, i.e. a timestamp that far in the past. */
const ago = (ms: number): number => NOW - ms;

describe('formatLastOpened', () => {
  describe('minutes', () => {
    it('reads "Just now" under a minute', () => {
      expect(formatLastOpened(ago(30_000), NOW)).toBe('Just now');
    });

    it('switches to minutes exactly at one minute', () => {
      expect(formatLastOpened(ago(MINUTE), NOW)).toBe('1 minute ago');
    });

    it('uses the plural past one minute', () => {
      expect(formatLastOpened(ago(5 * MINUTE), NOW)).toBe('5 minutes ago');
    });

    it('still reads in minutes at 59 minutes', () => {
      expect(formatLastOpened(ago(59 * MINUTE), NOW)).toBe('59 minutes ago');
    });
  });

  describe('hours', () => {
    it('switches to hours exactly at one hour', () => {
      expect(formatLastOpened(ago(HOUR), NOW)).toBe('1 hour ago');
    });

    it('still reads in hours at 23 hours', () => {
      expect(formatLastOpened(ago(23 * HOUR), NOW)).toBe('23 hours ago');
    });
  });

  describe('days', () => {
    it('switches to days exactly at 24 hours', () => {
      expect(formatLastOpened(ago(DAY), NOW)).toBe('1 day ago');
    });

    it('still reads in days at 6 days', () => {
      expect(formatLastOpened(ago(6 * DAY), NOW)).toBe('6 days ago');
    });
  });

  describe('weeks', () => {
    it('switches to weeks exactly at 7 days', () => {
      expect(formatLastOpened(ago(7 * DAY), NOW)).toBe('1 week ago');
    });

    it('reads 4 weeks at 29 days rather than rolling to months early', () => {
      expect(formatLastOpened(ago(29 * DAY), NOW)).toBe('4 weeks ago');
    });
  });

  describe('months', () => {
    it('switches to months at 30 days without reading "0 months"', () => {
      expect(formatLastOpened(ago(30 * DAY), NOW)).toBe('1 month ago');
    });

    it('clamps at 11 months rather than reading "12 months ago"', () => {
      expect(formatLastOpened(ago(364 * DAY), NOW)).toBe('11 months ago');
    });
  });

  describe('years', () => {
    it('switches to years exactly at 365 days', () => {
      expect(formatLastOpened(ago(365 * DAY), NOW)).toBe('1 year ago');
    });

    it('uses the plural past one year', () => {
      expect(formatLastOpened(ago(3 * 365 * DAY), NOW)).toBe('3 years ago');
    });
  });

  describe('falling back to an absolute date', () => {
    // 1825 days back from 1 Jul 2026 is 2 Jul 2021, not the 1st: 2024's
    // leap day falls inside the span.
    it('shows a date once the timestamp is five years old', () => {
      expect(formatLastOpened(ago(5 * 365 * DAY), NOW)).toBe('2 Jul 2021');
    });

    it('shows a date for a much older timestamp', () => {
      expect(formatLastOpened(Date.UTC(2019, 2, 12, 12, 0, 0), NOW)).toBe(
        '12 Mar 2019'
      );
    });
  });

  describe('clock skew and malformed input', () => {
    it('reads "Just now" for a timestamp in the future', () => {
      expect(formatLastOpened(NOW + 5 * MINUTE, NOW)).toBe('Just now');
    });

    it('reads "Just now" at exactly now', () => {
      expect(formatLastOpened(NOW, NOW)).toBe('Just now');
    });

    it('returns "Unknown" for NaN rather than "NaN minutes ago"', () => {
      expect(formatLastOpened(Number.NaN, NOW)).toBe('Unknown');
    });

    it('returns "Unknown" for Infinity', () => {
      expect(formatLastOpened(Number.POSITIVE_INFINITY, NOW)).toBe('Unknown');
    });
  });
});
