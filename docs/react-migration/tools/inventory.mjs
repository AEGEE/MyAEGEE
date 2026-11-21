#!/usr/bin/env node
// Inventory of the Vue frontend for the React migration spike.
//
// Scans frontend/src and writes docs/react-migration/data/inventory.json with, per route:
// the view it renders, its size, the API calls it makes (and the components it imports make),
// the third-party libraries it pulls in and a few complexity signals. It also sums these up
// per area (the views/ subdirectory) and gives each area a T-shirt size.
//
// Usage (from the repository root): node docs/react-migration/tools/inventory.mjs
// No dependencies: it's a regex/scanner pass over the source, good enough for counting.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../../..');
const src = path.join(root, 'frontend/src');
const outFile = path.join(root, 'docs/react-migration/data/inventory.json');
const require = createRequire(import.meta.url);

const routes = require(path.join(src, 'router/routes.js'));
const menu = JSON.parse(fs.readFileSync(path.join(src, 'menu.json'), 'utf8'));

const read = (file) => fs.readFileSync(file, 'utf8');
const rel = (file) => path.relative(root, file);
const countLines = (text) => text.split('\n').length;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
});

// --- API calls -------------------------------------------------------------------------------

// Reads the first argument of a call starting at `start` (just after the opening parenthesis).
const readFirstArgument = (text, start) => {
    let depth = 0;
    let quote = null;
    for (let i = start; i < text.length; i += 1) {
        const char = text[i];
        if (quote) {
            if (char === '\\') i += 1;
            else if (char === quote) quote = null;
        } else if (char === '\'' || char === '"' || char === '`') {
            quote = char;
        } else if ('([{'.includes(char)) {
            depth += 1;
        } else if (')]}'.includes(char)) {
            if (depth === 0) return text.slice(start, i);
            depth -= 1;
        } else if (char === ',' && depth === 0) {
            return text.slice(start, i);
        }
    }
    return text.slice(start);
};

// Turns `this.services['events'] + '/single/' + this.$route.params.id` into `events /single/:id`.
const normaliseUrl = (expression) => {
    let service = null;
    const parts = [];
    // Split on top-level `+`. Good enough for the string concatenations the views use.
    for (const rawPart of expression.split(/\s\+\s|\+(?=\s*['"`])|(?<=['"`])\s*\+/)) {
        const part = rawPart.trim();
        const serviceMatch = part.match(/services\[['"]([a-z-]+)['"]\]/);
        const literal = part.match(/^['"](.*)['"]$/);
        const template = part.match(/^`(.*)`$/s);
        if (serviceMatch) {
            service = serviceMatch[1];
        } else if (literal) {
            parts.push(literal[1]);
        } else if (template) {
            parts.push(template[1]
                .replace(/\$\{[^}]*services\[['"]([a-z-]+)['"]\]\}/, (_, name) => { service = name; return ''; })
                .replace(/\$\{([^}]*)\}/g, (_, inner) => `:${inner.split('.').pop().replace(/\W/g, '')}`));
        } else if (part) {
            parts.push(`:${part.split('.').pop().replace(/\W/g, '') || 'param'}`);
        }
    }
    return { service, path: parts.join('').replace(/\/+/g, '/') || '/' };
};

const findApiCalls = (text) => {
    const calls = [];
    const callPattern = /\baxios\.(get|post|put|patch|delete)\(/g;
    let match;
    while ((match = callPattern.exec(text))) {
        const argument = readFirstArgument(text, match.index + match[0].length);
        const { service, path: urlPath } = normaliseUrl(argument);
        calls.push({ method: match[1].toUpperCase(), service, path: urlPath });
    }
    return calls;
};

// --- Imports and components -----------------------------------------------------------------

const resolveImport = (fromFile, specifier) => {
    let base;
    if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromFile), specifier);
    else if (specifier.startsWith('src/')) base = path.join(src, specifier.slice(4));
    else if (/^(views|components)\//.test(specifier)) base = path.join(src, specifier);
    else return null;
    for (const candidate of [base, `${base}.vue`, `${base}.js`, path.join(base, 'index.js')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
};

const importsOf = (file, text) => [...text.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .map((specifier) => ({ specifier, file: resolveImport(file, specifier) }));

const THIRD_PARTY = {
    'vue-mapbox': 'Mapbox (vue-mapbox / mapbox-gl)',
    'mapbox-gl': 'Mapbox (vue-mapbox / mapbox-gl)',
    '@fullcalendar': 'FullCalendar',
    'vue-chartjs': 'Chart.js (vue-chartjs)',
    'chart.js': 'Chart.js (vue-chartjs)',
    'vue-multiselect': 'vue-multiselect',
    'vue-flatpickr-component': 'flatpickr',
    flatpickr: 'flatpickr',
    'vue-input-tag': 'vue-input-tag',
    'vue-infinite-loading': 'vue-infinite-loading',
    'vue-bulma-collapse': 'vue-bulma-collapse',
    moment: 'moment',
    lodash: 'lodash',
    ical: 'ical',
    marked: 'marked',
    dompurify: 'dompurify'
};

const thirdPartyName = (specifier) => {
    const key = Object.keys(THIRD_PARTY).find((name) => specifier === name || specifier.startsWith(`${name}/`));
    return key ? THIRD_PARTY[key] : null;
};

// Everything a file needs, including the local components it imports (recursively).
const analyseCache = new Map();
const analyse = (file, seen = new Set()) => {
    if (seen.has(file)) return { calls: [], thirdParty: new Set(), files: new Set() };
    seen.add(file);
    if (!analyseCache.has(file)) {
        const text = read(file);
        const template = (text.match(/<template>([\s\S]*)<\/template>/) || [, ''])[1];
        analyseCache.set(file, {
            text,
            lines: countLines(text),
            calls: findApiCalls(text),
            imports: importsOf(file, text),
            signals: {
                vHtml: (template.match(/v-html=/g) || []).length,
                buefyProgrammatic: (text.match(/\$buefy\.(toast|dialog|modal|loading|snackbar)/g) || []).length,
                buefyComponents: [...new Set(template.match(/<b-[a-z-]+/g) || [])].map((tag) => tag.slice(1)),
                rootHelpers: (text.match(/\$root\.show[A-Z]\w*/g) || []).length,
                formFields: (template.match(/<(input|textarea|select|b-input|b-select|b-datepicker|b-timepicker|b-autocomplete|b-checkbox|b-radio|b-switch|multiselect|flat-pickr|input-tag)\b/g) || []).length,
                tables: (template.match(/<(table|b-table)\b/g) || []).length,
                permissionChecks: (text.match(/my_permissions|permissions\.|\.combined|can\.[a-z_]+/g) || []).length,
                mapGetters: [...new Set([...text.matchAll(/mapGetters\(\{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/['"](\w+)['"]/g)].map((g) => g[1])))],
                routerPush: (text.match(/\$router\.(push|replace)/g) || []).length
            }
        });
    }
    const info = analyseCache.get(file);
    const calls = [...info.calls];
    const thirdParty = new Set();
    const files = new Set([file]);
    for (const { specifier, file: imported } of info.imports) {
        const name = thirdPartyName(specifier);
        if (name) thirdParty.add(name);
        if (imported && imported.endsWith('.vue')) {
            const child = analyse(imported, seen);
            calls.push(...child.calls);
            child.thirdParty.forEach((n) => thirdParty.add(n));
            child.files.forEach((f) => files.add(f));
        }
    }
    return { calls, thirdParty, files };
};

const uniqueCalls = (calls) => {
    const seen = new Map();
    for (const call of calls) seen.set(`${call.method} ${call.service ?? '?'} ${call.path}`, call);
    return [...seen.keys()].sort();
};

// --- Sizing ----------------------------------------------------------------------------------

// A rough score per area from the things that make a port slow. The weights are a judgement
// call, documented in 07-roadmap.md; the point is to rank areas, not to predict days.
const score = (area) => area.lines / 150
    + area.apiCalls.length * 0.5
    + area.signals.formFields / 6
    + area.signals.tables / 2
    + area.thirdParty.length * 2
    + area.signals.buefyProgrammatic / 2;

const size = (value) => {
    if (value < 15) return 'S';
    if (value < 50) return 'M';
    if (value < 120) return 'L';
    return 'XL';
};

// --- Run -------------------------------------------------------------------------------------

const menuNames = new Set();
const collectMenu = (items) => items.forEach((item) => {
    if (item.name) menuNames.add(item.name);
    if (item.components) collectMenu(item.components);
    if (item.children) collectMenu(item.children);
});
collectMenu(menu);

const routeEntries = routes.map((route) => {
    const file = path.join(src, 'views', `${route.component}.vue`);
    const exists = fs.existsSync(file);
    const result = exists ? analyse(file) : { calls: [], thirdParty: new Set(), files: new Set() };
    const own = exists ? analyseCache.get(file) : null;
    return {
        name: route.name,
        path: route.path,
        component: route.component,
        file: exists ? rel(file) : null,
        area: route.component.split('/')[0],
        label: route.meta?.label,
        auth: route.meta?.auth !== false,
        inMenu: menuNames.has(route.name),
        lines: own?.lines ?? 0,
        linesWithChildren: [...result.files].reduce((sum, f) => sum + analyseCache.get(f).lines, 0),
        childComponents: [...result.files].filter((f) => f !== file).map(rel),
        apiCalls: uniqueCalls(result.calls),
        thirdParty: [...result.thirdParty].sort(),
        signals: own?.signals ?? {}
    };
});

const viewFiles = walk(path.join(src, 'views')).filter((f) => f.endsWith('.vue'));
const routedFiles = new Set(routeEntries.map((r) => r.file));
viewFiles.forEach((f) => analyse(f));

const areas = {};
for (const file of viewFiles) {
    const area = path.relative(path.join(src, 'views'), file).split(path.sep)[0];
    const info = analyseCache.get(file);
    areas[area] ??= {
        area, routes: 0, views: 0, lines: 0, apiCalls: new Set(), thirdParty: new Set(),
        signals: { vHtml: 0, buefyProgrammatic: 0, formFields: 0, tables: 0, permissionChecks: 0, routerPush: 0 }
    };
    const entry = areas[area];
    entry.views += 1;
    entry.lines += info.lines;
    uniqueCalls(info.calls).forEach((call) => entry.apiCalls.add(call));
    info.imports.forEach(({ specifier }) => { const n = thirdPartyName(specifier); if (n) entry.thirdParty.add(n); });
    for (const key of Object.keys(entry.signals)) entry.signals[key] += info.signals[key];
}
routeEntries.forEach((route) => { if (areas[route.area]) areas[route.area].routes += 1; });

const areaList = Object.values(areas).map((area) => {
    const result = { ...area, apiCalls: [...area.apiCalls].sort(), thirdParty: [...area.thirdParty].sort() };
    result.score = Math.round(score(result) * 10) / 10;
    result.size = size(result.score);
    return result;
}).sort((a, b) => b.score - a.score);

const allCalls = new Map();
for (const file of [...analyseCache.keys()]) {
    for (const call of uniqueCalls(analyseCache.get(file).calls)) {
        allCalls.set(call, (allCalls.get(call) ?? new Set()).add(rel(file)));
    }
}

const inventory = {
    generatedBy: 'docs/react-migration/tools/inventory.mjs',
    totals: {
        routes: routeEntries.length,
        routesWithoutAuth: routeEntries.filter((r) => !r.auth).length,
        viewFiles: viewFiles.length,
        viewFilesNotRouted: viewFiles.filter((f) => !routedFiles.has(rel(f))).length,
        sharedComponents: walk(path.join(src, 'components')).filter((f) => f.endsWith('.vue')).length,
        viewLines: viewFiles.reduce((sum, f) => sum + analyseCache.get(f).lines, 0),
        distinctApiCalls: allCalls.size
    },
    areas: areaList,
    routes: routeEntries,
    apiCalls: [...allCalls.entries()].map(([call, files]) => ({ call, files: [...files].sort() })).sort((a, b) => a.call.localeCompare(b.call))
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(inventory, null, 2)}\n`);

console.log(`Wrote ${rel(outFile)}`);
console.table(inventory.totals);
console.table(areaList.map(({ area, routes: r, views, lines, apiCalls, thirdParty, score: s, size: z }) => ({
    area, routes: r, views, lines, apiCalls: apiCalls.length, thirdParty: thirdParty.join(', '), score: s, size: z
})));
