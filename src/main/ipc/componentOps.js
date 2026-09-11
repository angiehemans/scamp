import { promises as fs } from 'fs';
import { join } from 'path';
import { parseViewWrapper, viewSlugFor, viewWrapperTsx } from '@shared/templates';
import { COMPONENT_NAME_RE, DEFAULT_COMPONENT_CSS, defaultComponentTsx, } from './componentScaffold';
/**
 * Path layout for one component. Mirrors `pagePathsFor` in
 * shape — folder + TSX + CSS module, where the folder is the
 * component's canonical identifier.
 */
export const componentPathsFor = (projectPath, componentName, kind = 'component') => {
    const componentDir = join(projectPath, kind === 'view' ? 'views' : 'components', componentName);
    return {
        tsxPath: join(componentDir, `${componentName}.tsx`),
        cssPath: join(componentDir, `${componentName}.module.css`),
        componentDir,
    };
};
const pathExists = async (p) => {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
};
/**
 * Default starter content for a brand-new blank component. The
 * shape mirrors what `generateCode` emits for an empty root so
 * a parse → regen round-trip is text-stable: the renderer's
 * canonical-migration write doesn't fire after `loadComponent`,
 * which kept the `lastSerialized` cache in sync with the
 * chokidar `add` event for the freshly-written file. Without
 * that, the next chokidar event's echo guard missed and the
 * handler reloaded the empty tree on top of any rect the user
 * had just drawn. see docs/notes/component-scaffold-roundtrip.md
 */
/**
 * Refuses to operate on a non-Nextjs project — components don't
 * exist in the legacy layout, and silently no-op'ing would
 * leave the renderer with a dangling state. The renderer's
 * components sidebar handles the surfacing.
 */
const assertNextjs = (format) => {
    if (format !== 'nextjs') {
        throw new Error('Components are only supported in Next.js-format projects.');
    }
};
/** `app/<slug>/page.tsx` and its CSS module; `home` is the root page. */
export const wrapperPagePathsFor = (projectPath, slug) => {
    const pageDir = slug === 'home' ? null : join(projectPath, 'app', slug);
    const base = pageDir ?? join(projectPath, 'app');
    return {
        tsxPath: join(base, 'page.tsx'),
        cssPath: join(base, 'page.module.css'),
        pageDir,
    };
};
/**
 * Write the one-line wrapper page that renders a view. A page already
 * at the slug is left alone unless `replacePage` — the convert path —
 * in which case its TSX becomes the wrapper and its CSS module goes,
 * so the scan stops listing it as a page.
 */
const writeViewWrapper = async (projectPath, viewName, slug, replacePage) => {
    const { tsxPath, cssPath, pageDir } = wrapperPagePathsFor(projectPath, slug);
    if ((await pathExists(tsxPath)) && !replacePage)
        return;
    if (pageDir)
        await fs.mkdir(pageDir, { recursive: true });
    await fs.writeFile(tsxPath, viewWrapperTsx(viewName), 'utf-8');
    if (replacePage)
        await fs.rm(cssPath, { force: true });
};
/** Remove a view's wrapper page if `app/<slug>/page.tsx` is one for it. */
const removeViewWrapper = async (projectPath, viewName, slug) => {
    const { tsxPath, pageDir } = wrapperPagePathsFor(projectPath, slug);
    let tsx;
    try {
        tsx = await fs.readFile(tsxPath, 'utf-8');
    }
    catch {
        return;
    }
    if (parseViewWrapper(tsx) !== viewName)
        return;
    // The root page must exist for Next to serve `/`; a home wrapper is
    // left in place and the renderer says so.
    if (pageDir === null)
        return;
    await fs.rm(pageDir, { recursive: true, force: true });
};
export const createComponent = async (args, format) => {
    assertNextjs(format);
    const kind = args.kind ?? 'component';
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid ${kind} name "${args.componentName}". Use PascalCase letters and digits only (e.g. \`Button\`, \`HeroCard\`).`);
    }
    const { tsxPath, cssPath, componentDir } = componentPathsFor(args.projectPath, args.componentName, kind);
    // One namespace for both kinds: the store, thumbnails, and the props
    // type are all keyed by name, so a view and a component can't share one.
    const otherKind = kind === 'view' ? 'component' : 'view';
    const other = componentPathsFor(args.projectPath, args.componentName, otherKind);
    if (await pathExists(componentDir)) {
        throw new Error(`A ${kind} named "${args.componentName}" already exists.`);
    }
    if (await pathExists(other.componentDir)) {
        throw new Error(`A ${otherKind} named "${args.componentName}" already exists; views and components share one set of names.`);
    }
    await fs.mkdir(join(args.projectPath, kind === 'view' ? 'views' : 'components'), {
        recursive: true,
    });
    await fs.mkdir(componentDir, { recursive: false });
    const tsxContent = args.tsxContent ?? defaultComponentTsx(args.componentName);
    const cssContent = args.cssContent ?? DEFAULT_COMPONENT_CSS;
    await fs.writeFile(tsxPath, tsxContent, 'utf-8');
    await fs.writeFile(cssPath, cssContent, 'utf-8');
    if (kind === 'view' && typeof args.wrapperSlug === 'string') {
        await writeViewWrapper(args.projectPath, args.componentName, args.wrapperSlug, args.replacePage === true);
    }
    return {
        name: args.componentName,
        kind,
        tsxPath,
        cssPath,
        tsxContent,
        cssContent,
    };
};
export const deleteComponent = async (args, format) => {
    assertNextjs(format);
    const kind = args.kind ?? 'component';
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid ${kind} name "${args.componentName}".`);
    }
    const { componentDir } = componentPathsFor(args.projectPath, args.componentName, kind);
    await fs.rm(componentDir, { recursive: true, force: true });
    if (kind === 'view') {
        await removeViewWrapper(args.projectPath, args.componentName, viewSlugFor(args.componentName));
    }
};
export const readComponent = async (args, format) => {
    assertNextjs(format);
    const kind = args.kind ?? 'component';
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid ${kind} name "${args.componentName}".`);
    }
    const { tsxPath, cssPath } = componentPathsFor(args.projectPath, args.componentName, kind);
    try {
        const [tsxContent, cssContent] = await Promise.all([
            fs.readFile(tsxPath, 'utf-8'),
            fs.readFile(cssPath, 'utf-8'),
        ]);
        return {
            name: args.componentName,
            kind,
            tsxPath,
            cssPath,
            tsxContent,
            cssContent,
        };
    }
    catch {
        return null;
    }
};
// Sidebar thumbnail storage. see docs/notes/components-thumbnails.md
const thumbnailPathFor = (projectPath, componentName) => {
    const dir = join(projectPath, '.scamp', 'component-thumbs');
    const file = join(dir, `${componentName}.png`);
    return { dir, file };
};
const decodeDataUrl = (dataUrl) => {
    const comma = dataUrl.indexOf(',');
    if (comma < 0)
        throw new Error('Malformed data URL');
    const base64 = dataUrl.slice(comma + 1);
    return Buffer.from(base64, 'base64');
};
export const writeComponentThumbnail = async (args, format) => {
    assertNextjs(format);
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        return {
            ok: false,
            error: `Invalid component name "${args.componentName}".`,
        };
    }
    try {
        const { dir, file } = thumbnailPathFor(args.projectPath, args.componentName);
        await fs.mkdir(dir, { recursive: true });
        const buf = decodeDataUrl(args.dataUrl);
        await fs.writeFile(file, buf);
        return { ok: true, thumbnailPath: file };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Thumbnail write failed.',
        };
    }
};
export const readComponentThumbnail = async (args, format) => {
    assertNextjs(format);
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        return { base64: null };
    }
    const { file } = thumbnailPathFor(args.projectPath, args.componentName);
    try {
        const buf = await fs.readFile(file);
        return { base64: buf.toString('base64') };
    }
    catch {
        return { base64: null };
    }
};
