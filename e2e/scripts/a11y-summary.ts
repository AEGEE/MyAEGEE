// Sums up the axe results of ui/a11y/baseline.spec.ts (a11y-results/<frontend>/*.json) into
// docs/react-migration/data/a11y-baseline.json and prints a Markdown table per rule.
// Usage: node scripts/a11y-summary.ts
import fs from 'node:fs';
import path from 'node:path';

interface Violation {
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    tags: string[];
    nodes: number;
}

interface PageResult {
    route: string;
    url: string;
    component: string;
    frontend: string;
    violations: Violation[];
}

const root = path.resolve(import.meta.dirname, '..');
const resultsDir = path.join(root, 'a11y-results');
const outFile = path.resolve(root, '../docs/react-migration/data/a11y-baseline.json');

const frontends = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir) : [];
if (frontends.length === 0) {
    console.error('No results in e2e/a11y-results. Run: npx playwright test -c playwright.ui.config.ts --grep @a11y');
    process.exit(1);
}

const summary: Record<string, unknown> = { generatedBy: 'e2e/scripts/a11y-summary.ts', rules: 'axe-core, WCAG 2.2 A + AA tags' };
for (const frontend of frontends) {
    const pages: PageResult[] = fs.readdirSync(path.join(resultsDir, frontend))
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(fs.readFileSync(path.join(resultsDir, frontend, file), 'utf8')) as PageResult);

    const rules = new Map<string, { id: string; impact: string | null; help: string; helpUrl: string; tags: string[]; pages: number; nodes: number }>();
    for (const page of pages) {
        for (const violation of page.violations) {
            const rule = rules.get(violation.id) ?? { ...violation, pages: 0, nodes: 0 };
            rule.pages += 1;
            rule.nodes += violation.nodes;
            rules.set(violation.id, rule);
        }
    }

    const byImpact: Record<string, number> = {};
    for (const rule of rules.values()) byImpact[rule.impact ?? 'unknown'] = (byImpact[rule.impact ?? 'unknown'] ?? 0) + rule.nodes;

    summary[frontend] = {
        pages: pages.length,
        pagesWithViolations: pages.filter((page) => page.violations.length > 0).length,
        elements: [...rules.values()].reduce((sum, rule) => sum + rule.nodes, 0),
        byImpact,
        rules: [...rules.values()].sort((a, b) => b.pages - a.pages || b.nodes - a.nodes),
        perPage: pages
            .map((page) => ({ route: page.route, url: page.url, rules: page.violations.length, elements: page.violations.reduce((sum, v) => sum + v.nodes, 0) }))
            .sort((a, b) => b.elements - a.elements)
    };

    console.log(`\n## ${frontend}: ${pages.length} pages\n`);
    console.log('| Rule | Impact | WCAG | Pages | Elements |\n|---|---|---|---:|---:|');
    for (const rule of [...rules.values()].sort((a, b) => b.pages - a.pages || b.nodes - a.nodes)) {
        console.log(`| [${rule.id}](${rule.helpUrl}) ${rule.help} | ${rule.impact} | ${rule.tags.join(', ')} | ${rule.pages} | ${rule.nodes} |`);
    }
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`\nWrote ${path.relative(path.resolve(root, '..'), outFile)}`);
