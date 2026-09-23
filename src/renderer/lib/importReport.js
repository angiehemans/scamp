const DESCRIPTIONS = {
    'pseudo-element': {
        label: (n) => `${n} decorative ::before/::after ${n === 1 ? 'element' : 'elements'} dropped — icons, dividers, counters`,
        lost: true,
    },
    'shadow-root': {
        label: (n) => `${n} web ${n === 1 ? 'component' : 'components'} could not be read`,
        lost: true,
    },
    canvas: {
        label: (n) => `${n} <canvas> ${n === 1 ? 'element' : 'elements'} — drawn by script, so empty here`,
        lost: true,
    },
    iframe: {
        label: (n) => `${n} embedded ${n === 1 ? 'frame' : 'frames'} — the contents are another page`,
        lost: true,
    },
    'unsupported-display': {
        label: (n) => `${n} ${n === 1 ? 'element uses' : 'elements use'} table layout, which has no equivalent`,
        lost: true,
    },
    'depth-capped': {
        label: (n) => `${n} ${n === 1 ? 'subtree' : 'subtrees'} nested too deeply to read`,
        lost: true,
    },
    'node-capped': {
        label: () => 'the page was larger than one import could take',
        lost: true,
    },
    svg: {
        label: (n) => `${n} inline ${n === 1 ? 'icon' : 'icons'} kept as markup — they render, but are not editable as shapes`,
        lost: false,
    },
    'background-image': {
        label: (n) => `${n} background ${n === 1 ? 'image' : 'images'}`,
        lost: false,
    },
    'revealed-on-scroll': {
        label: (n) => `${n} ${n === 1 ? 'element that fades' : 'elements that fade'} in on scroll, captured visible`,
        lost: false,
    },
    'inline-kept': {
        label: (n) => `${n} ${n === 1 ? 'run' : 'runs'} of inline markup kept as text — links and bold inside a sentence are part of it now`,
        lost: false,
    },
    'block-to-flex': {
        label: (n) => `${n} block ${n === 1 ? 'container' : 'containers'} became flex columns`,
        lost: false,
    },
    'breakpoint-captured': {
        label: (n) => `${n} responsive ${n === 1 ? 'override' : 'overrides'} read from the page's own media queries`,
        lost: false,
    },
    'breakpoint-absent': {
        label: (n) => `${n} ${n === 1 ? 'element is' : 'elements are'} missing at a narrower width — Scamp cannot say "hidden below this size"`,
        lost: true,
    },
    'restored-auto-margin': {
        label: (n) => `${n} centred ${n === 1 ? 'container' : 'containers'} re-centred with auto margins`,
        lost: false,
    },
    'collapsed-wrapper': {
        label: (n) => `${n} empty ${n === 1 ? 'wrapper' : 'wrappers'} removed`,
        lost: false,
    },
    'dropped-computed-size': {
        label: (n) => `${n} measured ${n === 1 ? 'size' : 'sizes'} replaced with fill, so the design still reflows`,
        lost: false,
    },
    'wrapped-bare-text': {
        label: (n) => `${n} ${n === 1 ? 'run' : 'runs'} of loose text wrapped in a text element`,
        lost: false,
    },
    'marker-leaked': {
        label: (n) => `${n} ${n === 1 ? 'binding' : 'bindings'} failed to parse — this is a bug in Scamp`,
        lost: true,
    },
};
/** How many locations to keep per group. Enough to find it, not a dump. */
const MAX_EXAMPLES = 4;
export const buildReport = (findings) => {
    const byKind = new Map();
    for (const finding of findings) {
        const entry = byKind.get(finding.kind) ?? { count: 0, examples: [] };
        entry.count += 1;
        const where = finding.at ?? finding.detail;
        if (where !== undefined && entry.examples.length < MAX_EXAMPLES && !entry.examples.includes(where)) {
            entry.examples.push(where);
        }
        byKind.set(finding.kind, entry);
    }
    const groups = [];
    for (const [kind, { count, examples }] of byKind) {
        const describe = DESCRIPTIONS[kind];
        groups.push({
            kind,
            // An unknown kind still gets a readable line rather than being
            // dropped — a finding nobody described is still a finding.
            label: describe ? describe.label(count) : `${count} x ${kind.replace(/-/g, ' ')}`,
            count,
            examples,
            lost: describe?.lost ?? true,
        });
    }
    // Losses first, then by how much of the page each one touched.
    return groups.sort((a, b) => {
        if (a.lost !== b.lost)
            return a.lost ? -1 : 1;
        return b.count - a.count;
    });
};
