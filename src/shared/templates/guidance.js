import { AGENT_MD_CONTENT, AGENT_MD_CONTENT_LEGACY, AGENT_MD_CONTENT_SCAMP, } from './agentMd';
/** The guidance an agent working in a project of this format should read. */
export const guidanceFor = (format) => {
    if (format === 'scamp')
        return AGENT_MD_CONTENT_SCAMP;
    if (format === 'legacy')
        return AGENT_MD_CONTENT_LEGACY;
    return AGENT_MD_CONTENT;
};
/**
 * Top-level (`##`) sections in document order. `###` headings stay
 * inside their parent: they are subsections of one topic, and an agent
 * asking about "HTML tags" wants the tag-specific attributes with it.
 */
export const guidanceSections = (md) => {
    const out = [];
    let title = null;
    let body = [];
    const flush = () => {
        if (title === null)
            return;
        out.push({ title, body: body.join('\n').trim() });
    };
    let inFence = false;
    for (const line of md.split('\n')) {
        // A `##` inside a fenced block is a CSS comment or shell prompt,
        // not a heading.
        if (line.startsWith('```'))
            inFence = !inFence;
        if (!inFence && line.startsWith('## ')) {
            flush();
            title = line.slice(3).trim();
            body = [];
            continue;
        }
        if (title !== null)
            body.push(line);
    }
    flush();
    return out;
};
/** Section titles in document order — the menu an agent picks from. */
export const guidanceSectionTitles = (md) => guidanceSections(md).map((section) => section.title);
const normalise = (value) => value
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/**
 * Find a section by name, forgivingly: exact title, then a normalised
 * match (case, punctuation and backticks ignored), then a prefix, then
 * a substring. An agent naming a section from memory should not have to
 * reproduce "Per-element states (`:hover`, `:active`, `:focus`)".
 */
export const findGuidanceSection = (md, name) => {
    const sections = guidanceSections(md);
    const wanted = normalise(name);
    if (wanted.length === 0)
        return null;
    const exact = sections.find((s) => s.title === name);
    if (exact)
        return exact;
    const normal = sections.find((s) => normalise(s.title) === wanted);
    if (normal)
        return normal;
    const prefix = sections.find((s) => normalise(s.title).startsWith(wanted));
    if (prefix)
        return prefix;
    const substring = sections.find((s) => normalise(s.title).includes(wanted));
    if (substring)
        return substring;
    // Last resort: separators removed entirely rather than turned into
    // spaces, so `tldr` still reaches `TL;DR`.
    const squashed = wanted.replace(/ /g, '');
    return (sections.find((s) => normalise(s.title).replace(/ /g, '').includes(squashed)) ?? null);
};
/**
 * The summary an agent gets when it asks for no section in particular:
 * the TL;DR, which is written to be exactly that. Falls back to the
 * text before the first heading rather than returning nothing.
 */
export const guidanceSummary = (md) => {
    const tldr = findGuidanceSection(md, 'TL;DR');
    if (tldr !== null)
        return tldr.body;
    const firstHeading = md.indexOf('\n## ');
    return (firstHeading === -1 ? md : md.slice(0, firstHeading)).trim();
};
