import { defaultLayoutTsx, LEGACY_LAYOUT_TEMPLATES } from './agentMd';
export const decideLayoutMigration = (current, projectName) => {
    const latest = defaultLayoutTsx(projectName);
    if (current === latest)
        return { kind: 'noop' };
    for (const legacy of LEGACY_LAYOUT_TEMPLATES(projectName)) {
        if (current === legacy)
            return { kind: 'replace', next: latest };
    }
    return {
        kind: 'warn',
        reason: "app/layout.tsx doesn't include the recommended body reset (margin: 0; min-height: 100vh). Preview may render with the browser's default body margin until it's added.",
    };
};
