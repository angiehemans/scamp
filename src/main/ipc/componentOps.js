import { promises as fs } from 'fs';
import { join } from 'path';
/**
 * Folder + binding identifier for a Scamp component. Must be
 * PascalCase: the folder name, the TSX filename, the React
 * function name, AND every page's `import` binding all share
 * this string, so it has to be a valid JSX identifier. Disallow
 * underscores and hyphens — they would break Capitalised-tag
 * detection in the parser.
 */
const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
/**
 * Path layout for one component. Mirrors `pagePathsFor` in
 * shape — folder + TSX + CSS module, where the folder is the
 * component's canonical identifier.
 */
export const componentPathsFor = (projectPath, componentName) => {
    const componentDir = join(projectPath, 'components', componentName);
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
const defaultComponentTsx = (componentName) => `import styles from './${componentName}.module.css';

export default function ${componentName}() {
  return (
    <div data-scamp-id="root" className={styles.root} />
  );
}
`;
const DEFAULT_COMPONENT_CSS = `.root {
  width: 100%;
  min-height: 100vh;
  position: relative;
}
`;
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
export const createComponent = async (args, format) => {
    assertNextjs(format);
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid component name "${args.componentName}". Use PascalCase letters and digits only (e.g. \`Button\`, \`HeroCard\`).`);
    }
    const { tsxPath, cssPath, componentDir } = componentPathsFor(args.projectPath, args.componentName);
    if (await pathExists(componentDir)) {
        throw new Error(`A component named "${args.componentName}" already exists.`);
    }
    // Ensure the parent `components/` exists before creating the
    // per-component subfolder so the recursive mkdir below works
    // on a fresh project.
    await fs.mkdir(join(args.projectPath, 'components'), { recursive: true });
    await fs.mkdir(componentDir, { recursive: false });
    // Initial content: the convert-to-component flow passes
    // pre-generated TSX + CSS that captures the source subtree's
    // design. A plain-add flow leaves both undefined, falling back
    // to the canonical blank scaffold.
    const tsxContent = args.tsxContent ?? defaultComponentTsx(args.componentName);
    const cssContent = args.cssContent ?? DEFAULT_COMPONENT_CSS;
    await fs.writeFile(tsxPath, tsxContent, 'utf-8');
    await fs.writeFile(cssPath, cssContent, 'utf-8');
    return {
        name: args.componentName,
        tsxPath,
        cssPath,
        tsxContent,
        cssContent,
    };
};
export const deleteComponent = async (args, format) => {
    assertNextjs(format);
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid component name "${args.componentName}".`);
    }
    const { componentDir } = componentPathsFor(args.projectPath, args.componentName);
    // Recursive remove — the folder contains exactly the TSX + CSS
    // pair (plus any thumbnails Phase 9 adds later), all owned by
    // Scamp. `force: true` makes the call idempotent if the user /
    // an agent already deleted the folder out from under us.
    await fs.rm(componentDir, { recursive: true, force: true });
};
export const readComponent = async (args, format) => {
    assertNextjs(format);
    if (!COMPONENT_NAME_RE.test(args.componentName)) {
        throw new Error(`Invalid component name "${args.componentName}".`);
    }
    const { tsxPath, cssPath } = componentPathsFor(args.projectPath, args.componentName);
    try {
        const [tsxContent, cssContent] = await Promise.all([
            fs.readFile(tsxPath, 'utf-8'),
            fs.readFile(cssPath, 'utf-8'),
        ]);
        return {
            name: args.componentName,
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
