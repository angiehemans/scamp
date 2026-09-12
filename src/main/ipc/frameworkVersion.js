import { promises as fs } from 'fs';
import { join } from 'path';
/**
 * What version of the framework a project has installed, and which
 * contract it implements — read from `node_modules/scampjs/package.json`
 * (the package keeps `./package.json` in its exports map for this).
 * A project that was never installed has neither; that isn't an error,
 * the banner just says which version to install.
 * see docs/plans/framework-phase-1-plan.md, step 6
 */
export const readFrameworkInfo = async (projectPath) => {
    try {
        const raw = await fs.readFile(join(projectPath, 'node_modules', 'scampjs', 'package.json'), 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return { installedVersion: null, contract: null };
        const pkg = parsed;
        const version = typeof pkg.version === 'string' ? pkg.version : null;
        const contract = typeof pkg.scampjs?.contract === 'number' && Number.isInteger(pkg.scampjs.contract)
            ? pkg.scampjs.contract
            : null;
        return { installedVersion: version, contract };
    }
    catch {
        return { installedVersion: null, contract: null };
    }
};
/** The `scampjs` version range a project's package.json asks for, if any. */
export const readRequestedFrameworkRange = async (projectPath) => {
    try {
        const raw = await fs.readFile(join(projectPath, 'package.json'), 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        const pkg = parsed;
        const range = pkg.dependencies?.['scampjs'] ?? pkg.devDependencies?.['scampjs'];
        return typeof range === 'string' ? range : null;
    }
    catch {
        return null;
    }
};
