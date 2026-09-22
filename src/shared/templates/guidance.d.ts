import type { ProjectFormat } from '../types';
/**
 * The guidance, sliced so an agent can be handed the part it needs.
 *
 * `agent.md` is ~1400 lines and regenerated on every project open. An
 * agent that reads it spends a lot of context on rules that don't apply
 * to the change in front of it; one that skips it gets nothing. Serving
 * the same text through MCP lets it ask for the summary, then the one
 * section it needs. Same source as the file, so the two cannot drift.
 * see docs/notes/agent-md-layouts.md
 */
export type GuidanceSection = {
    /** The heading, without the leading `## `. */
    title: string;
    /** Everything under it, up to the next `##`, trimmed. */
    body: string;
};
/** The guidance an agent working in a project of this format should read. */
export declare const guidanceFor: (format: ProjectFormat) => string;
/**
 * Top-level (`##`) sections in document order. `###` headings stay
 * inside their parent: they are subsections of one topic, and an agent
 * asking about "HTML tags" wants the tag-specific attributes with it.
 */
export declare const guidanceSections: (md: string) => GuidanceSection[];
/** Section titles in document order — the menu an agent picks from. */
export declare const guidanceSectionTitles: (md: string) => string[];
/**
 * Find a section by name, forgivingly: exact title, then a normalised
 * match (case, punctuation and backticks ignored), then a prefix, then
 * a substring. An agent naming a section from memory should not have to
 * reproduce "Per-element states (`:hover`, `:active`, `:focus`)".
 */
export declare const findGuidanceSection: (md: string, name: string) => GuidanceSection | null;
/**
 * The summary an agent gets when it asks for no section in particular:
 * the TL;DR, which is written to be exactly that. Falls back to the
 * text before the first heading rather than returning nothing.
 */
export declare const guidanceSummary: (md: string) => string;
