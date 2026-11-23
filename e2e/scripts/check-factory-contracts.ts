// Fails when a mock factory has no contract check. Part of `npm run lint`.
//
// Every function a file in ui/support/factories/ exports builds an entity for the mocked-API
// suite, and has to be compared with the real service's answer somewhere in
// tests/*-contract.spec.ts, as `expectShape('<export name>', …)`. Not checked: the helpers in
// base.ts, and the names a file lists in its `export const NOT_ENTITIES = [...]` (builders made
// of other builders' output, like seedPermissions).
// The other way round, an `expectShape` name that isn't an export of any factory file is an
// error too: it's a typo or a factory that was renamed, and would hide a missing check.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const factoriesDir = path.join(root, 'ui/support/factories');
const testsDir = path.join(root, 'tests');
const relative = (file: string): string => path.relative(root, file);

const specs = fs.readdirSync(testsDir)
    .filter((file) => file.endsWith('-contract.spec.ts'))
    .map((file) => path.join(testsDir, file));

// The names checked, with the specs that check them.
const checked = new Map<string, string[]>();
for (const spec of specs) {
    for (const [, name] of fs.readFileSync(spec, 'utf8').matchAll(/\bexpectShape\(\s*['"`]([^'"`]+)['"`]/g)) {
        checked.set(name, [...(checked.get(name) ?? []), relative(spec)]);
    }
}

const problems: string[] = [];
const known = new Set<string>();
let entities = 0;

for (const file of fs.readdirSync(factoriesDir).filter((name) => name.endsWith('.ts')).sort()) {
    const fullPath = path.join(factoriesDir, file);
    const exports = await import(pathToFileURL(fullPath).href) as Record<string, unknown>;
    const functions = Object.keys(exports).filter((name) => typeof exports[name] === 'function');
    functions.forEach((name) => known.add(name));
    if (file === 'base.ts') continue;

    const notEntities = exports.NOT_ENTITIES ?? [];
    if (!Array.isArray(notEntities) || notEntities.some((name) => !functions.includes(name))) {
        problems.push(`${relative(fullPath)}: NOT_ENTITIES has to be a list of functions this file exports.`);
        continue;
    }

    for (const name of functions.filter((item) => !notEntities.includes(item))) {
        entities++;
        if (!checked.has(name)) {
            problems.push(`${relative(fullPath)}: ${name}() has no contract check. Compare it with the real answer in a tests/*-contract.spec.ts: expectShape('${name}', ${name}(), real).`);
        }
    }
}

for (const [name, files] of checked) {
    if (!known.has(name)) {
        problems.push(`${files.join(', ')}: expectShape('${name}', …) names no factory. The first argument is the factory's export name.`);
    }
}

if (problems.length > 0) {
    console.error(`Factory contract check failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    process.exit(1);
}

console.log(`Factory contracts: ${entities} factories checked in ${specs.length} contract specs.`);
