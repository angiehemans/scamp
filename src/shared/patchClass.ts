import postcss from 'postcss';

export type PatchMediaScope = {
  /** Max-width in pixels. Targets the `@media (max-width: Npx)` block. */
  maxWidth: number;
};

/**
 * Replace just one class block in a CSS module file.
 *
 * Used by `file:patch` from the renderer's properties panel: the user
 * commits a new declaration body for one class, and the rest of the
 * file (other classes, comments, blank lines) must stay byte-identical
 * wherever postcss can preserve it.
 *
 * If the class doesn't exist yet, append a new block at the end. This
 * lets the renderer "create" a class via the same patch path it uses
 * to update one.
 *
 * When `media` is provided, the patch targets a class rule INSIDE the
 * matching `@media (max-width: Npx)` block rather than the base
 * class. The at-rule and the class rule inside it are both created
 * if missing. This is how the properties panel writes
 * breakpoint-specific declarations.
 *
 * The function is pure — no IO, so it tests cleanly in isolation.
 */
export const patchClassBlock = (
  source: string,
  className: string,
  newDeclarations: string,
  media?: PatchMediaScope
): string => {
  const declarations = newDeclarations.trim();

  let root: postcss.Root;
  try {
    root = postcss.parse(source);
  } catch {
    // If the file isn't parseable, fall back to appending the block raw —
    // better than throwing an error from the IPC handler.
    return media
      ? appendMediaBlock(source, media, className, declarations)
      : appendBlock(source, className, declarations);
  }

  if (media) {
    return patchInsideMedia(root, className, declarations, media);
  }

  // Base-class patch (no media scope).
  let foundExisting = false;
  root.walkRules(`.${className}`, (rule) => {
    // Skip class rules nested inside @media — those belong to a
    // media-scoped patch, not the base patch.
    if (rule.parent && rule.parent.type === 'atrule') return;
    foundExisting = true;
    // postcss exposes nodes for each declaration; we replace the whole
    // body by removing existing nodes and re-inserting the new ones.
    rule.removeAll();
    if (declarations.length > 0) {
      const parsed = postcss.parse(`.x{${declarations}}`);
      const newRule = parsed.first as postcss.Rule | undefined;
      if (newRule) {
        newRule.each((node) => {
          rule.append(node.clone());
        });
      }
    }
  });

  if (!foundExisting) {
    return appendBlock(source, className, declarations);
  }

  return root.toString();
};

/**
 * Patch (or create) the class rule inside the `@media (max-width: Npx)`
 * block matching `media`. Creates the at-rule if needed; creates the
 * class rule inside it if needed.
 */
const patchInsideMedia = (
  root: postcss.Root,
  className: string,
  declarations: string,
  media: PatchMediaScope
): string => {
  const targetQuery = normalizeParams(`(max-width: ${media.maxWidth}px)`);

  // Find the @media atrule matching our query.
  let atRule: postcss.AtRule | null = null;
  root.walkAtRules('media', (rule) => {
    if (normalizeParams(rule.params) === targetQuery) {
      atRule = rule;
      return false;
    }
    return undefined;
  });

  if (!atRule) {
    // Create the @media block fresh and put the class rule inside.
    const block = buildMediaBlock(media, className, declarations);
    const separator =
      root.toString().length === 0 || root.toString().endsWith('\n')
        ? ''
        : '\n';
    return `${root.toString()}${separator}\n${block}`;
  }

  // Find the class rule inside the @media. Using a typed local const
  // so TypeScript narrows the possibly-null atRule reference.
  const media$ = atRule as postcss.AtRule;
  let foundRule: postcss.Rule | null = null;
  media$.walkRules(`.${className}`, (rule) => {
    foundRule = rule;
    return false;
  });

  if (foundRule) {
    const existing = foundRule as postcss.Rule;
    existing.removeAll();
    if (declarations.length > 0) {
      const parsed = postcss.parse(`.x{${declarations}}`);
      const newRule = parsed.first as postcss.Rule | undefined;
      if (newRule) {
        newRule.each((node) => {
          existing.append(node.clone());
        });
      }
    }
    // If the class rule is now empty AND there are no other rules in
    // the @media, drop the whole at-rule so the file doesn't grow
    // empty scaffolding.
    const siblings = media$.nodes ?? [];
    if (declarations.length === 0 && siblings.every((n) => n === existing)) {
      media$.remove();
    } else if (declarations.length === 0) {
      existing.remove();
    }
    return root.toString();
  }

  if (declarations.length === 0) {
    // Nothing to write and nothing to remove — no-op.
    return root.toString();
  }

  // Append the class rule inside the existing @media.
  const classRule = postcss.parse(
    `.${className} {${declarations}}`
  ).first as postcss.Rule | undefined;
  if (classRule) {
    media$.append(classRule.clone());
  }
  return root.toString();
};

const normalizeParams = (params: string): string => {
  // postcss preserves original whitespace inside `(...)`. Collapse
  // extra spaces so we match `(max-width:768px)`,
  // `(max-width: 768px)`, and `(  max-width : 768px  )` the same way.
  return params.trim().replace(/\s+/g, '');
};

const buildMediaBlock = (
  media: PatchMediaScope,
  className: string,
  declarations: string
): string => {
  const indented = declarations
    .split('\n')
    .map((line) => (line.trim().length > 0 ? `    ${line.trim()}` : ''))
    .filter((line) => line.length > 0)
    .join('\n');
  return `@media (max-width: ${media.maxWidth}px) {\n  .${className} {\n${indented}\n  }\n}\n`;
};

const appendMediaBlock = (
  source: string,
  media: PatchMediaScope,
  className: string,
  declarations: string
): string => {
  const sep = source.length === 0 || source.endsWith('\n') ? '\n' : '\n\n';
  return `${source}${sep}${buildMediaBlock(media, className, declarations)}`;
};

const appendBlock = (source: string, className: string, declarations: string): string => {
  const indented = declarations
    .split('\n')
    .map((line) => (line.trim().length > 0 ? `  ${line.trim()}` : ''))
    .filter((line) => line.length > 0)
    .join('\n');
  const sep = source.length === 0 || source.endsWith('\n') ? '\n' : '\n\n';
  return `${source}${sep}.${className} {\n${indented}\n}\n`;
};
