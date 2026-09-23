import { useEffect } from 'react';

import { errorMessage } from '@shared/errorMessage';
import type { CapturePayload } from '@shared/importCapture';
import type { ProjectData } from '@shared/types';
import { viewSlugFor } from '@shared/templates';
import { generateCode } from '@lib/generateCode';
import { reduceCapture, type ImportFinding } from '@lib/importReduce';
import { extractTokens } from '@lib/importTokens';
import { parseThemeFile, serializeThemeFile } from '@lib/parseTheme';
import { useAppLogStore } from '@store/appLogSlice';

/**
 * The app window's half of website import.
 *
 * The import window captures a page and hands the payload here, because
 * this is where the project is: the reducer, the generator, and the
 * file-writing IPC all live on this side. The importer itself never
 * touches a file.
 *
 * A view is created and filled in two steps rather than one — `+ Add
 * Page`'s own path writes the view and its route, and then the
 * generated markup replaces the scaffold's. Reusing it means an
 * imported view is indistinguishable from a hand-made one, route
 * included.
 * see docs/plans/website-import-plan.md
 */

type Options = {
  project: ProjectData;
  onProjectChange?: (update: (prev: ProjectData) => ProjectData) => void;
  /** Opens the freshly-imported view on the canvas. */
  openView: (name: string) => void;
};

/** One line per finding, collapsed by kind so a report reads at a glance. */
const summarize = (findings: ReadonlyArray<ImportFinding>): string[] => {
  const byKind = new Map<string, number>();
  for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  const phrase: Record<string, (n: number) => string> = {
    'pseudo-element': (n) => `${n} decorative ::before/::after ${n === 1 ? 'element' : 'elements'}`,
    'shadow-root': (n) => `${n} shadow ${n === 1 ? 'root' : 'roots'}`,
    canvas: (n) => `${n} <canvas>`,
    iframe: (n) => `${n} <iframe>`,
    svg: (n) => `${n} inline ${n === 1 ? 'icon' : 'icons'} kept as markup, not editable as shapes`,
    'revealed-on-scroll': (n) =>
      `${n} ${n === 1 ? 'element' : 'elements'} that fade in on scroll, captured visible`,
    'background-image': (n) => `${n} background ${n === 1 ? 'image' : 'images'} still remote`,
    'unsupported-display': (n) => `${n} table or list-item layout`,
    // Not a loss, but the biggest single thing an import changes about
    // a page, and worth saying out loud.
    'block-to-flex': (n) => `${n} block ${n === 1 ? 'container' : 'containers'} became flex`,
    'restored-auto-margin': (n) => `${n} centred ${n === 1 ? 'container' : 'containers'} re-centred`,
    // Worth saying: the markup renders, but it is no longer separately
    // selectable on the canvas — it is part of its paragraph's text.
    'inline-kept': (n) =>
      `${n} ${n === 1 ? 'run' : 'runs'} of inline markup kept as text, not as elements`,
    'depth-capped': (n) => `${n} ${n === 1 ? 'subtree' : 'subtrees'} too deep to read`,
    'node-capped': () => 'the page was larger than one import',
  };
  const out: string[] = [];
  for (const [kind, n] of byKind) {
    const say = phrase[kind];
    if (say) out.push(say(n));
  }
  return out;
};

/**
 * A view name the project doesn't already use. An import should never
 * silently land on top of existing work.
 */
const freeViewName = (base: string, taken: ReadonlySet<string>): string => {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
};

export const useWebsiteImport = ({
  project,
  onProjectChange,
  openView,
}: Options): void => {
  useEffect(() => {
    return window.scamp.onImportDeliver(({ projectPath, payload }) => {
      void (async (): Promise<void> => {
        const log = useAppLogStore.getState().log;
        const report = (p: Parameters<typeof window.scamp.reportImportResult>[0]): void => {
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
          const reduced = reduceCapture(payload as CapturePayload);

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
          const renamed = tokens.map((t) =>
            existing.has(t.name) ? { ...t, name: `${t.name}-imported` } : t
          );
          const byOld = new Map(tokens.map((t, i) => [t.name, renamed[i]?.name ?? t.name]));
          const themed = Object.fromEntries(
            Object.entries(elements).map(([id, el]) => {
              let next = el;
              for (const field of ['color', 'backgroundColor', 'borderColor'] as const) {
                const value = next[field];
                if (typeof value !== 'string' || !value.startsWith('var(')) continue;
                const name = value.slice(4, -1);
                const mapped = byOld.get(name);
                if (mapped && mapped !== name) next = { ...next, [field]: `var(${mapped})` };
              }
              return [id, next];
            })
          );
          const result = { ...reduced, elements: themed };

          if (renamed.length > 0) {
            await window.scamp.writeTheme({
              projectPath: project.path,
              content: serializeThemeFile(
                {
                  ...parsedTheme,
                  tokens: [
                    ...parsedTheme.tokens,
                    ...renamed.map((t) => ({ name: t.name, value: t.value })),
                  ],
                },
                themeCss
              ),
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

          // Images: downloaded after the view exists, so a slow or dead
          // host delays pictures rather than the whole import. Each
          // failure is reported and the rest carry on.
          const assets = (payload as CapturePayload).assets.filter((a) => a.kind === 'image');
          const downloaded = new Map<string, string>();
          const failedAssets: string[] = [];
          for (const asset of assets) {
            if (downloaded.has(asset.url) || !/^https?:/.test(asset.url)) continue;
            const got = await window.scamp.fetchImportImage({
              url: asset.url,
              projectPath: project.path,
            });
            if (got.ok) downloaded.set(asset.url, got.relativePath);
            else failedAssets.push(`${new URL(asset.url).pathname.split('/').pop()}: ${got.error}`);
          }
          if (downloaded.size > 0) {
            const localised = Object.fromEntries(
              Object.entries(result.elements).map(([id, el]) => {
                let next = el;
                const src = next.src;
                if (typeof src === 'string' && downloaded.has(src)) {
                  next = { ...next, src: downloaded.get(src) as string };
                }
                const bg = next.customProperties?.['background-image'];
                if (typeof bg === 'string') {
                  for (const [url, local] of downloaded) {
                    if (!bg.includes(url)) continue;
                    next = {
                      ...next,
                      customProperties: {
                        ...next.customProperties,
                        'background-image': bg.split(url).join(local),
                      },
                    };
                    break;
                  }
                }
                return [id, next];
              })
            );
            const relocated = generateCode({
              elements: localised,
              rootId: result.rootId,
              pageName: name,
              cssModuleImportName: name,
              isComponent: true,
            });
            await window.scamp.writeFile({
              tsxPath: created.tsxPath,
              cssPath: created.cssPath,
              tsxContent: relocated.tsx,
              cssContent: relocated.css,
            });
          }

          const findings = summarize(result.findings);
          log(
            'info',
            `Imported ${name} from ${(payload as CapturePayload).url} — ` +
              `${Object.keys(result.elements).length} elements` +
              (renamed.length > 0 ? `, ${renamed.length} colour tokens` : '') +
              (findings.length > 0 ? `. Not carried across: ${findings.join(', ')}.` : '.')
          );
          report({
            projectPath,
            ok: true,
            viewName: name,
            elementCount: Object.keys(result.elements).length,
            findings: [
              ...(downloaded.size > 0
                ? [`${downloaded.size} images downloaded into the project`]
                : []),
              ...(failedAssets.length > 0
                ? [`${failedAssets.length} images could not be fetched (${failedAssets[0]})`]
                : []),
              ...(renamed.length > 0
                ? [`${renamed.length} repeated colours lifted into theme tokens`]
                : []),
              ...findings,
            ],
          });
        } catch (err) {
          const message = errorMessage(err);
          log('error', `Import failed: ${message}`);
          report({ projectPath, ok: false, error: message });
        }
      })();
    });
  }, [project, onProjectChange, openView]);
};
