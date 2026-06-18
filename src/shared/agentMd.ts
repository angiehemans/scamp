/**
 * Barrel for the project-scaffolding + agent-guidance templates. Split
 * (4.6) into `templates/{agentMd,themeCss,pageScaffold,nextConfig}.ts`:
 *   - agentMd      — the CLAUDE.md stub + agent.md guidance (legacy + nextjs)
 *   - themeCss     — theme.css / page.css scaffolding (font, reset, tokens)
 *   - pageScaffold — page/layout TSX + package.json templates
 *   - nextConfig   — next.config.ts template
 *
 * The two agent.md templates are ~900 lines each (irreducible user-facing
 * markdown), so `templates/agentMd.ts` stays large; the rest are small.
 * Re-export preserves every `@shared/agentMd` import.
 */
export * from './templates';
