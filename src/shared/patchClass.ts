import postcss from 'postcss';

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
 * The function is pure — no IO, so it tests cleanly in isolation.
 */
export const patchClassBlock = (
  source: string,
  className: string,
  newDeclarations: string
): string => {
  const declarations = newDeclarations.trim();
  let foundExisting = false;

  let root: postcss.Root;
  try {
    root = postcss.parse(source);
  } catch {
    // If the file isn't parseable, fall back to appending the block raw —
    // better than throwing an error from the IPC handler.
    return appendBlock(source, className, declarations);
  }

  root.walkRules(`.${className}`, (rule) => {
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

const appendBlock = (source: string, className: string, declarations: string): string => {
  const indented = declarations
    .split('\n')
    .map((line) => (line.trim().length > 0 ? `  ${line.trim()}` : ''))
    .filter((line) => line.length > 0)
    .join('\n');
  const sep = source.length === 0 || source.endsWith('\n') ? '\n' : '\n\n';
  return `${source}${sep}.${className} {\n${indented}\n}\n`;
};
