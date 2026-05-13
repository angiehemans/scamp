import type { ScampElement } from '@lib/element';
import type { HistoryEntry } from './historyTypes';
/**
 * Generate the human-readable label for a history entry. Pure
 * function of the entry plus the LIVE elements map — that's how
 * retroactive renames work.
 */
export declare const formatHistoryLabel: (entry: HistoryEntry, elements: Record<string, ScampElement>) => string;
/**
 * Format a wall-clock timestamp as a relative string for the
 * history panel.
 *
 *   < 30s   → "just now"
 *   < 60s   → "30 sec ago"
 *   < 60 min → "N min ago"
 *   < 24h   → "N hr ago"
 *   ≥ 24h   → absolute HH:MM
 */
export declare const formatRelativeTime: (ts: number, now: number) => string;
