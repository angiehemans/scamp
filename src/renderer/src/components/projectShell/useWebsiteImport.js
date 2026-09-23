import { useEffect } from 'react';
import { errorMessage } from '@shared/errorMessage';
import { viewSlugFor } from '@shared/templates';
import { generateCode } from '@lib/generateCode';
import { reduceCapture } from '@lib/importReduce';
import { useAppLogStore } from '@store/appLogSlice';
/** One line per finding, collapsed by kind so a report reads at a glance. */
const summarize = (findings) => {
    const byKind = new Map();
    for (const f of findings)
        byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
    const phrase = {
        'pseudo-element': (n) => `${n} decorative ::before/::after ${n === 1 ? 'element' : 'elements'}`,
        'shadow-root': (n) => `${n} shadow ${n === 1 ? 'root' : 'roots'}`,
        canvas: (n) => `${n} <canvas>`,
        iframe: (n) => `${n} <iframe>`,
        svg: (n) => `${n} inline SVG`,
        'background-image': (n) => `${n} background ${n === 1 ? 'image' : 'images'} still remote`,
        'unsupported-display': (n) => `${n} table or list-item layout`,
        // Not a loss, but the biggest single thing an import changes about
        // a page, and worth saying out loud.
        'block-to-flex': (n) => `${n} block ${n === 1 ? 'container' : 'containers'} became flex`,
        'restored-auto-margin': (n) => `${n} centred ${n === 1 ? 'container' : 'containers'} re-centred`,
        // Worth saying: the markup renders, but it is no longer separately
        // selectable on the canvas — it is part of its paragraph's text.
        'inline-kept': (n) => `${n} ${n === 1 ? 'run' : 'runs'} of inline markup kept as text, not as elements`,
        'depth-capped': (n) => `${n} ${n === 1 ? 'subtree' : 'subtrees'} too deep to read`,
        'node-capped': () => 'the page was larger than one import',
    };
    const out = [];
    for (const [kind, n] of byKind) {
        const say = phrase[kind];
        if (say)
            out.push(say(n));
    }
    return out;
};
/**
 * A view name the project doesn't already use. An import should never
 * silently land on top of existing work.
 */
const freeViewName = (base, taken) => {
    if (!taken.has(base))
        return base;
    for (let n = 2; n < 1000; n += 1) {
        const candidate = `${base}${n}`;
        if (!taken.has(candidate))
            return candidate;
    }
    return `${base}${Date.now()}`;
};
export const useWebsiteImport = ({ project, onProjectChange, openView, }) => {
    useEffect(() => {
        return window.scamp.onImportDeliver(({ projectPath, payload }) => {
            void (async () => {
                const log = useAppLogStore.getState().log;
                const report = (p) => {
                    void window.scamp.reportImportResult(p);
                };
                if (projectPath !== project.path) {
                    report({
                        projectPath,
                        ok: false,
                        error: 'That import was for a different project.',
                    });
                    return;
                }
                try {
                    const result = reduceCapture(payload);
                    const taken = new Set([
                        ...project.components.map((c) => c.name),
                        ...project.pages.map((p) => p.name),
                    ]);
                    const name = freeViewName(result.suggestedName, taken);
                    const { tsx, css } = generateCode({
                        elements: result.elements,
                        rootId: result.rootId,
                        pageName: name,
                        cssModuleImportName: name,
                        isComponent: true,
                    });
                    // A view, not a page: a framework project has no pages, and in
                    // a Next.js one a view is still the shape an import should
                    // take. `createComponent` writes the files and the wrapper or
                    // route in one call, so there is no window where a half-made
                    // view exists on disk.
                    const created = await window.scamp.createComponent({
                        projectPath: project.path,
                        componentName: name,
                        kind: 'view',
                        wrapperSlug: viewSlugFor(name),
                        tsxContent: tsx,
                        cssContent: css,
                    });
                    onProjectChange?.((prev) => ({
                        ...prev,
                        components: prev.components.some((c) => c.name === created.name)
                            ? prev.components
                            : [...prev.components, created],
                    }));
                    openView(created.name);
                    const findings = summarize(result.findings);
                    log('info', `Imported ${name} from ${payload.url} — ` +
                        `${Object.keys(result.elements).length} elements` +
                        (findings.length > 0 ? `. Not carried across: ${findings.join(', ')}.` : '.'));
                    report({
                        projectPath,
                        ok: true,
                        viewName: name,
                        elementCount: Object.keys(result.elements).length,
                        findings,
                    });
                }
                catch (err) {
                    const message = errorMessage(err);
                    log('error', `Import failed: ${message}`);
                    report({ projectPath, ok: false, error: message });
                }
            })();
        });
    }, [project, onProjectChange, openView]);
};
