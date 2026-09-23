import { useEffect } from 'react';
import { errorMessage } from '@shared/errorMessage';
import { viewSlugFor } from '@shared/templates';
import { generateCode } from '@lib/generateCode';
import { reduceCapture } from '@lib/importReduce';
import { extractTokens } from '@lib/importTokens';
import { parseThemeFile, serializeThemeFile } from '@lib/parseTheme';
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
        svg: (n) => `${n} inline ${n === 1 ? 'icon' : 'icons'} kept as markup, not editable as shapes`,
        'revealed-on-scroll': (n) => `${n} ${n === 1 ? 'element' : 'elements'} that fade in on scroll, captured visible`,
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
                    const reduced = reduceCapture(payload);
                    // Lift repeated colours into theme tokens before generating,
                    // so the view references `var(--color-accent)` rather than the
                    // same literal forty times. Without this an import is a
                    // snapshot: correct, and unchangeable from the theme panel.
                    const themeCss = await window.scamp.readTheme({ projectPath: project.path });
                    const parsedTheme = parseThemeFile(themeCss);
                    const existing = new Set(parsedTheme.tokens.map((t) => t.name));
                    const { tokens, elements } = extractTokens(reduced.elements);
                    // A name the project already uses means something else here;
                    // suffix rather than redefine someone's token.
                    const renamed = tokens.map((t) => existing.has(t.name) ? { ...t, name: `${t.name}-imported` } : t);
                    const byOld = new Map(tokens.map((t, i) => [t.name, renamed[i]?.name ?? t.name]));
                    const themed = Object.fromEntries(Object.entries(elements).map(([id, el]) => {
                        let next = el;
                        for (const field of ['color', 'backgroundColor', 'borderColor']) {
                            const value = next[field];
                            if (typeof value !== 'string' || !value.startsWith('var('))
                                continue;
                            const name = value.slice(4, -1);
                            const mapped = byOld.get(name);
                            if (mapped && mapped !== name)
                                next = { ...next, [field]: `var(${mapped})` };
                        }
                        return [id, next];
                    }));
                    const result = { ...reduced, elements: themed };
                    if (renamed.length > 0) {
                        await window.scamp.writeTheme({
                            projectPath: project.path,
                            content: serializeThemeFile({
                                ...parsedTheme,
                                tokens: [
                                    ...parsedTheme.tokens,
                                    ...renamed.map((t) => ({ name: t.name, value: t.value })),
                                ],
                            }, themeCss),
                        });
                    }
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
                        (renamed.length > 0 ? `, ${renamed.length} colour tokens` : '') +
                        (findings.length > 0 ? `. Not carried across: ${findings.join(', ')}.` : '.'));
                    report({
                        projectPath,
                        ok: true,
                        viewName: name,
                        elementCount: Object.keys(result.elements).length,
                        findings: [
                            ...(renamed.length > 0
                                ? [`${renamed.length} repeated colours lifted into theme tokens`]
                                : []),
                            ...findings,
                        ],
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
