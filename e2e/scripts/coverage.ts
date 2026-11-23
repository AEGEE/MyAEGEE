// Frontend coverage: what the Playwright suites ran of frontend/src, reported and gated per area.
//
// Usage: node scripts/coverage.ts <command>
//   merge [--raw <dir>…] [--routes <dir>…] [--build <dir>]
//       Adds up the files that the suites wrote with E2E_COVERAGE=1 (.coverage/raw, .coverage/routes)
//       on top of the baseline of the instrumented build (.coverage/build), in which every file
//       starts uncovered. Fails when the data comes from different builds. Writes
//       .coverage/merged.json (<script> and .js code on their source lines), .coverage/render (the
//       compiled templates the report shows) and .coverage/route-visits.json. Directories are
//       searched with their subdirectories.
//   report
//       From the merge: the HTML report (.coverage/report/index.html), coverage-summary.json and
//       lcov.info in .coverage/report, and the table per area on stdout and in .coverage/summary.md.
//   gate [--base <commit>]
//       Checks every area that is `enforced` in ui/support/coverage/<area>.json against the
//       thresholds in ui/support/coverage/thresholds.json, and that each of its routes was
//       opened by a behavioural test. Also everything `gate-config` checks.
//   gate-config [--base <commit>]
//       The part of the gate that needs no coverage data: the area files and the thresholds are
//       well-formed, every exception has a real reason, and the gate didn't get weaker since
//       the base (scripts/coverage-gate.ts) unless ui/support/coverage/downgrades.json accepts
//       that. The base is the merge base with origin/stable, in CI on stable the commit before.
//
// An area is a directory of frontend/src/views, or `shell` for everything else in frontend/src.
// A .vue file is measured twice: its <script> on the lines of the file, and its template as the
// render function that Vue compiles it to (views/…/Foo.vue.template.js in the report), where
// v-if, v-else, v-show and ternaries are branches.
import fs from 'node:fs';
import path from 'node:path';

import libCoverage, { type CoverageMap, type FileCoverage, type FileCoverageData } from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import { createSourceMapStore } from 'istanbul-lib-source-maps';
import reports from 'istanbul-reports';
import ts from 'typescript';

import {
    addHits, APP_ROUTES, COVERAGE_DIR, RAW_DIR, ROUTES_DIR, type RawCoverage, type RouteVisits
} from '../support/coverage.ts';
import { findIgnoreComments } from './check-ignores.ts';
import {
    AREA_CONFIG_PATH, GATED_METRICS, NOT_AREA_FILES, THRESHOLDS_FILE, areaOfFile, commitTree, compareWithBase, gitIn, resolveBase, squash, workingTree,
    type Thresholds
} from './coverage-gate.ts';
import { reasonProblem } from './reason.ts';

const root = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(root, 'frontend/src');
const AREA_CONFIG_DIR = path.join(root, AREA_CONFIG_PATH);

const BUILD_DIR = path.join(COVERAGE_DIR, 'build');
const MERGED_FILE = path.join(COVERAGE_DIR, 'merged.json');
const RENDER_DIR = path.join(COVERAGE_DIR, 'render');
const ROUTE_VISITS_FILE = path.join(COVERAGE_DIR, 'route-visits.json');
const REPORT_DIR = path.join(COVERAGE_DIR, 'report');
const SUMMARY_FILE = path.join(COVERAGE_DIR, 'summary.md');

const SHELL = 'shell';
const TEMPLATE_SUFFIX = '.template.js';

class UsageError extends Error {}

// For messages: the path from the repository root, or the whole path of a file outside it.
const fromRoot = (file: string): string => (file.startsWith(root + path.sep) ? path.relative(root, file) : file);

const jsonFiles = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => path.join(entry.parentPath, entry.name))
        .sort();
};

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

// ---------------------------------------------------------------------------------------------
// merge

interface BaselineFile {
    // Where the build had the file, which is how the raw data names it.
    builtPath: string;
    // Where it is in this checkout.
    path: string;
    data: FileCoverageData & { hash: string; inputSourceMap?: { sources: string[] } };
}

// The build writes one file per instrumented file: baseline/<path under src>.json for a
// <script> or .js file, baseline/<path under src>.template.json for a compiled template.
const readBaseline = (buildDir: string): BaselineFile[] => {
    const baselineDir = path.join(buildDir, 'baseline');
    return jsonFiles(baselineDir).map((file) => {
        const [[builtPath, data]] = Object.entries(readJson<Record<string, BaselineFile['data']>>(file));
        const name = path.relative(baselineDir, file).replace(/\.json$/, '');
        return {
            builtPath,
            path: name.endsWith('.template') ? path.join(RENDER_DIR, `${name}.js`) : path.join(SRC, name),
            data
        };
    });
};

const options = (args: string[], names: string[]): Record<string, string[]> => {
    const values: Record<string, string[]> = Object.fromEntries(names.map((name) => [name, []]));
    let current: string[] | undefined;
    for (const arg of args) {
        if (arg.startsWith('--')) {
            current = values[arg.slice(2)];
            if (!current) throw new UsageError(`Unknown option ${arg}.`);
        } else if (current) {
            current.push(path.resolve(arg));
        } else {
            throw new UsageError(`Unexpected argument ${arg}.`);
        }
    }
    return values;
};

const merge = async (args: string[]): Promise<void> => {
    const given = options(args, ['raw', 'routes', 'build']);
    if (given.build.length > 1) throw new UsageError('Only one --build directory can be given.');
    const buildDir = given.build[0] ?? BUILD_DIR;
    const rawDirs = given.raw.length > 0 ? given.raw : [RAW_DIR];
    const routeDirs = given.routes.length > 0 ? given.routes : [ROUTES_DIR];

    const baseline = readBaseline(buildDir);
    if (baseline.length === 0) {
        throw new UsageError(`No baseline in ${fromRoot(buildDir)}: build the instrumented frontend first (\`npm run setup\` in e2e/).`);
    }
    const rawFiles = rawDirs.flatMap(jsonFiles);
    if (rawFiles.length === 0) {
        throw new UsageError(`No coverage data in ${rawDirs.map(fromRoot).join(', ')}: run the suites with E2E_COVERAGE=1.`);
    }

    // Every file of the build with the hash of its instrumented code, then which raw files
    // have which hash for it. More than one hash for a file means more than one build.
    const builtFiles = new Map(baseline.map((file) => [file.builtPath, file]));
    const hashes = new Map<string, Map<string, string[]>>();
    const unknown = new Map<string, string[]>();
    const total: RawCoverage = {};
    for (const rawFile of rawFiles) {
        const raw = readJson<RawCoverage>(rawFile);
        for (const [file, hits] of Object.entries(raw)) {
            const built = builtFiles.get(file);
            if (!built) {
                unknown.set(file, [...unknown.get(file) ?? [], fromRoot(rawFile)]);
                continue;
            }
            if (!hashes.has(file)) hashes.set(file, new Map([[built.data.hash, [`${fromRoot(buildDir)} (the build)`]]]));
            const sources = hashes.get(file)!;
            sources.set(hits.hash, [...sources.get(hits.hash) ?? [], fromRoot(rawFile)]);
            if (hits.hash === built.data.hash) addHits(total, { [file]: hits });
        }
    }

    const mixed = [...hashes].filter(([, sources]) => sources.size > 1);
    if (mixed.length > 0 || unknown.size > 0) {
        const lines = [
            ...mixed.map(([file, sources]) => `${file}\n${[...sources].map(([hash, from]) => `    ${hash}: ${from.join(', ')}`).join('\n')}`),
            ...[...unknown].map(([file, from]) => `${file}\n    not in the build, but in ${from.join(', ')}`)
        ];
        throw new UsageError([
            `The coverage data comes from different builds of the frontend (${lines.length} file(s) differ):`,
            ...lines.slice(0, 20).map((line) => `  ${line}`),
            ...(lines.length > 20 ? [`  … and ${lines.length - 20} more`] : []),
            'Every suite and shard has to test a build of the same code, in a checkout at the same path.',
            'Locally: remove e2e/.coverage/raw and e2e/.coverage/routes, then run the suites again.'
        ].join('\n'));
    }

    // The baseline with the counts filled in, under the paths of this checkout.
    const here = new Map(baseline.map((file) => [file.builtPath, file.path]));
    const map = libCoverage.createCoverageMap({});
    for (const file of baseline) {
        const hits = total[file.builtPath];
        const { inputSourceMap } = file.data;
        map.addFileCoverage({
            ...file.data,
            path: file.path,
            ...(hits ? { s: hits.s, f: hits.f, b: hits.b } : {}),
            ...(inputSourceMap ? { inputSourceMap: { ...inputSourceMap, sources: inputSourceMap.sources.map((source) => here.get(source) ?? source) } } : {})
        } as FileCoverageData);
    }
    // <script> and .js code goes back to its source lines; the compiled templates have no source map.
    const mapped = await createSourceMapStore().transformCoverage(map);

    const visits: Record<string, Set<string>> = {};
    for (const file of routeDirs.flatMap(jsonFiles)) {
        for (const [route, tests] of Object.entries(readJson<RouteVisits>(file))) {
            visits[route] ??= new Set();
            tests.forEach((test) => visits[route].add(test));
        }
    }

    fs.mkdirSync(COVERAGE_DIR, { recursive: true });
    fs.writeFileSync(MERGED_FILE, JSON.stringify(mapped));
    fs.rmSync(RENDER_DIR, { recursive: true, force: true });
    fs.cpSync(path.join(buildDir, 'render'), RENDER_DIR, { recursive: true });
    fs.writeFileSync(ROUTE_VISITS_FILE, JSON.stringify(
        Object.fromEntries(Object.keys(visits).sort().map((route) => [route, [...visits[route]].sort()])),
        null,
        2
    ));
    console.log(`Merged ${rawFiles.length} raw file(s) over the ${baseline.length} instrumented files of ${fromRoot(buildDir)} into ${fromRoot(MERGED_FILE)}.`);
};

// ---------------------------------------------------------------------------------------------
// numbers per file and area

interface TemplateException {
    file: string;
    condition: string;
    reason: string;
}

interface AreaConfig {
    gate: 'pending' | 'enforced';
    templateExceptions: TemplateException[];
}

interface Count {
    covered: number;
    total: number;
}

interface Numbers {
    scriptLines: Count;
    scriptBranches: Count;
    // v-if, v-else-if, v-else, v-show and ternaries, without the template exceptions.
    templateBranches: Count;
    // For information only: `a || b` and `a && b` in a template, and its functions
    // (handlers, slots, v-for bodies).
    templateShortCircuits: Count;
    templateFunctions: Count;
    exceptedBranches: number;
}

const GATED = GATED_METRICS;
const LABELS = {
    scriptLines: 'script lines',
    scriptBranches: 'script branches',
    templateBranches: 'template branches',
    templateShortCircuits: 'template short-circuits',
    templateFunctions: 'template functions'
} as const;
type Metric = keyof typeof LABELS;
const METRICS = Object.keys(LABELS) as Metric[];

const emptyNumbers = (): Numbers => ({
    scriptLines: { covered: 0, total: 0 },
    scriptBranches: { covered: 0, total: 0 },
    templateBranches: { covered: 0, total: 0 },
    templateShortCircuits: { covered: 0, total: 0 },
    templateFunctions: { covered: 0, total: 0 },
    exceptedBranches: 0
});

const add = (into: Numbers, from: Numbers): void => {
    for (const metric of METRICS) {
        into[metric].covered += from[metric].covered;
        into[metric].total += from[metric].total;
    }
    into.exceptedBranches += from.exceptedBranches;
};

const percent = ({ covered, total }: Count): number => (total === 0 ? 100 : (100 * covered) / total);
const show = (count: Count): string => (count.total === 0 ? '-' : `${percent(count).toFixed(1)} % (${count.covered}/${count.total})`);

// A file of the merge: its path under frontend/src (a compiled template under the path of its
// .vue file) and the area that owns it.
interface Source {
    name: string;
    template: boolean;
    area: string;
    coverage: FileCoverage;
}

const sourcesOf = (map: CoverageMap): Source[] => map.files().sort().map((file) => {
    const template = file.startsWith(RENDER_DIR + path.sep);
    const name = template ? path.relative(RENDER_DIR, file).slice(0, -TEMPLATE_SUFFIX.length) : path.relative(SRC, file);
    if (name.startsWith('..')) throw new UsageError(`${file} in ${fromRoot(MERGED_FILE)} is not a file of frontend/src: merge again.`);
    return { name, template, area: areaOfFile(name), coverage: map.fileCoverageFor(file) };
});

// The conditions of a compiled template by the position where their `x ? a : b` or `if (x)`
// starts, as istanbul numbers it (lines from 1, columns from 0).
const conditionsOf = (file: string): Map<string, string> => {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const conditions = new Map<string, string>();
    const visit = (node: ts.Node): void => {
        const test = (ts.isConditionalExpression(node) && node.condition) || (ts.isIfStatement(node) && node.expression);
        if (test) {
            const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
            conditions.set(`${line + 1}:${character}`, squash(test.getText(source)));
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return conditions;
};

interface ExceptionUse {
    exception: TemplateException;
    // Conditionals in the template with this condition, and how many of them still have a
    // branch that never ran.
    matched: number;
    uncovered: number;
}

const numbersOf = (source: Source, exceptions: ExceptionUse[]): Numbers => {
    const numbers = emptyNumbers();
    const { coverage } = source;
    if (!source.template) {
        const summary = coverage.toSummary();
        numbers.scriptLines = { covered: summary.lines.covered, total: summary.lines.total };
        numbers.scriptBranches = { covered: summary.branches.covered, total: summary.branches.total };
        return numbers;
    }

    const own = exceptions.filter(({ exception }) => exception.file === source.name);
    const conditions = own.length > 0 ? conditionsOf(coverage.path) : undefined;
    for (const [id, branch] of Object.entries(coverage.branchMap)) {
        const hits = coverage.b[id];
        const covered = hits.filter((count) => count > 0).length;
        if (branch.type === 'binary-expr') {
            numbers.templateShortCircuits.covered += covered;
            numbers.templateShortCircuits.total += hits.length;
        } else if (branch.type === 'cond-expr' || branch.type === 'if') {
            const condition = conditions?.get(`${branch.loc.start.line}:${branch.loc.start.column}`);
            const used = own.filter(({ exception }) => squash(exception.condition) === condition);
            if (used.length > 0) {
                for (const use of used) {
                    use.matched += 1;
                    if (covered < hits.length) use.uncovered += 1;
                }
                numbers.exceptedBranches += hits.length;
            } else {
                numbers.templateBranches.covered += covered;
                numbers.templateBranches.total += hits.length;
            }
        }
    }
    const functions = coverage.toSummary().functions;
    numbers.templateFunctions = { covered: functions.covered, total: functions.total };
    return numbers;
};

interface AreaResult {
    area: string;
    config: AreaConfig;
    numbers: Numbers;
    files: { source: Source; numbers: Numbers }[];
    exceptions: ExceptionUse[];
}

const areaNames = (): string[] => [
    ...fs.readdirSync(path.join(SRC, 'views'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    SHELL
];

// Reads ui/support/coverage/<area>.json for every area. Returns what is wrong with the files as well.
const readAreaConfigs = (areas: string[]): { configs: Map<string, AreaConfig>; problems: string[] } => {
    const configs = new Map<string, AreaConfig>();
    const problems: string[] = [];
    const extra = fs.readdirSync(AREA_CONFIG_DIR).filter((file) => !NOT_AREA_FILES.includes(file) && !areas.includes(file.replace(/\.json$/, '')));
    if (extra.length > 0) problems.push(`${fromRoot(AREA_CONFIG_DIR)} has files for areas that don't exist: ${extra.join(', ')}`);

    for (const area of areas) {
        const file = path.join(AREA_CONFIG_DIR, `${area}.json`);
        const where = fromRoot(file);
        const fallback: AreaConfig = { gate: 'pending', templateExceptions: [] };
        configs.set(area, fallback);
        if (!fs.existsSync(file)) {
            problems.push(`${where} is missing: every area needs one, with at least {"gate": "pending", "templateExceptions": []}`);
            continue;
        }
        let config: Partial<AreaConfig>;
        try {
            config = readJson<Partial<AreaConfig>>(file);
        } catch (error) {
            problems.push(`${where} is not valid JSON: ${(error as Error).message}`);
            continue;
        }
        if (config.gate !== 'pending' && config.gate !== 'enforced') problems.push(`${where}: "gate" has to be "pending" or "enforced"`);
        if (!Array.isArray(config.templateExceptions)) {
            problems.push(`${where}: "templateExceptions" has to be a list`);
            continue;
        }
        const exceptions = config.templateExceptions.filter((exception, index) => {
            const label = `${where}: templateExceptions[${index}]`;
            const complete = ['file', 'condition', 'reason'].every((key) => typeof exception?.[key as keyof TemplateException] === 'string' && exception[key as keyof TemplateException].trim() !== '');
            if (!complete) {
                problems.push(`${label} needs a "file", a "condition" and a "reason"`);
            } else if (areaOfFile(exception.file) !== area) {
                problems.push(`${label}: ${exception.file} belongs to the area ${areaOfFile(exception.file)}, not to ${area}`);
            } else if (config.templateExceptions!.findIndex((other) => other?.file === exception.file && squash(String(other?.condition)) === squash(exception.condition)) !== index) {
                problems.push(`${label} is there twice`);
            } else if (reasonProblem(exception.reason, { not: [exception.condition, exception.file] })) {
                problems.push(`${label}: the reason ${reasonProblem(exception.reason, { not: [exception.condition, exception.file] })}`);
            } else {
                return true;
            }
            return false;
        });
        configs.set(area, { gate: config.gate === 'enforced' ? 'enforced' : 'pending', templateExceptions: exceptions });
    }
    return { configs, problems };
};

// What an enforced area has to reach, in percent.
const readThresholds = (): Thresholds => {
    const file = path.join(AREA_CONFIG_DIR, THRESHOLDS_FILE);
    const usage = `${fromRoot(file)} has to give a percentage for ${GATED.map((metric) => `"${metric}"`).join(', ')} and nothing else`;
    if (!fs.existsSync(file)) throw new UsageError(`${usage}, but the file is missing.`);
    let given: Record<string, unknown>;
    try {
        given = readJson<Record<string, unknown>>(file);
    } catch (error) {
        throw new UsageError(`${fromRoot(file)} is not valid JSON: ${(error as Error).message}`);
    }
    const valid = typeof given === 'object' && given !== null
        && Object.keys(given).sort().join() === [...GATED].sort().join()
        && GATED.every((metric) => typeof given[metric] === 'number' && given[metric] >= 0 && given[metric] <= 100);
    if (!valid) throw new UsageError(`${usage}.`);
    return given as Thresholds;
};

// The gate's own files against their base: what got weaker has to be accepted in so many words.
const checkAgainstBase = (base: string | undefined): string[] => {
    const git = gitIn(root);
    const resolved = resolveBase(base, process.env, git);
    if ('problem' in resolved) {
        // Without a base nothing can be compared. That is fine on a machine without the
        // history of stable, and never in CI, where it would switch the check off for good.
        if (process.env.CI || base) return [`The gate can't be compared with its base: ${resolved.problem}`];
        console.log(`Changes to the gate itself: not checked, ${resolved.problem}.\n`);
        return [];
    }

    const ignoreFiles = [...new Set(findIgnoreComments().map((comment) => comment.file))];
    const { lines, problems } = compareWithBase(workingTree(root), commitTree(git, resolved.ref), ignoreFiles);
    console.log(`Changes to the gate itself since ${resolved.ref.slice(0, 9)} (${resolved.from}):${lines.length > 0 ? '' : ' none that weaken it.'}`);
    // At the start of a line, so `grep ^COVERAGE-` finds them in a log.
    if (lines.length > 0) console.log(lines.join('\n'));
    console.log('');
    return problems;
};

const readMerged = (): CoverageMap => {
    if (!fs.existsSync(MERGED_FILE)) throw new UsageError(`${fromRoot(MERGED_FILE)} is missing: run \`node scripts/coverage.ts merge\` first.`);
    return libCoverage.createCoverageMap(readJson<Record<string, FileCoverageData>>(MERGED_FILE));
};

const measure = (map: CoverageMap): { results: AreaResult[]; problems: string[] } => {
    const areas = areaNames();
    const { configs, problems } = readAreaConfigs(areas);
    const sources = sourcesOf(map);
    const results = areas.map((area): AreaResult => {
        const config = configs.get(area)!;
        const exceptions = config.templateExceptions.map((exception) => ({ exception, matched: 0, uncovered: 0 }));
        const files = sources.filter((source) => source.area === area).map((source) => ({ source, numbers: numbersOf(source, exceptions) }));
        const numbers = emptyNumbers();
        files.forEach((file) => add(numbers, file.numbers));
        return { area, config, numbers, files, exceptions };
    });

    // An exception that leaves nothing out hides the next change of that template.
    for (const { area, exceptions } of results) {
        for (const { exception, matched, uncovered } of exceptions) {
            const where = `${fromRoot(path.join(AREA_CONFIG_DIR, `${area}.json`))}: the exception for \`${exception.condition}\` in ${exception.file}`;
            if (matched === 0) problems.push(`${where} matches no v-if, v-show or ternary of that template: remove or update it`);
            else if (uncovered === 0) problems.push(`${where} is not needed any more, both sides are covered: remove it`);
        }
    }
    return { results, problems };
};

// ---------------------------------------------------------------------------------------------
// report

const table = (header: string[], rows: string[][]): string[] => [
    `| ${header.join(' | ')} |`,
    `|${header.map((_, index) => (index === 0 || header[index] === 'Gate' ? '---' : '---:')).join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
];

const areaTable = (results: AreaResult[]): string[] => {
    const all = emptyNumbers();
    results.forEach((result) => add(all, result.numbers));
    return table(
        ['Area', 'Gate', ...METRICS.map((metric) => LABELS[metric].replace(/^./, (letter) => letter.toUpperCase()))],
        [
            ...results.map(({ area, config, numbers }) => [area, config.gate, ...METRICS.map((metric) => show(numbers[metric]))]),
            ['all', '', ...METRICS.map((metric) => show(all[metric]))]
        ]
    );
};

const report = (): void => {
    const THRESHOLDS = readThresholds();
    const map = readMerged();
    const { results, problems } = measure(map);

    fs.rmSync(REPORT_DIR, { recursive: true, force: true });
    const context = libReport.createContext({ dir: REPORT_DIR, coverageMap: map, defaultSummarizer: 'nested' });
    reports.create('html').execute(context);
    reports.create('json-summary').execute(context);

    // For Codecov, which can only show files that are in the repository: no compiled templates,
    // and paths from the repository root.
    const scripts = libCoverage.createCoverageMap({});
    map.files().filter((file) => !file.startsWith(RENDER_DIR + path.sep)).forEach((file) => scripts.addFileCoverage(map.fileCoverageFor(file)));
    reports.create('lcovonly', { file: 'lcov.info', projectRoot: root }).execute(libReport.createContext({ dir: REPORT_DIR, coverageMap: scripts }));

    const areas = areaTable(results);
    const ignores = findIgnoreComments();
    const exceptions = results.flatMap((result) => result.config.templateExceptions);
    const summary = [
        '## Frontend coverage',
        '',
        ...areas,
        '',
        `An area with the gate \`enforced\` needs ${GATED.map((metric) => `${LABELS[metric]} >= ${THRESHOLDS[metric]} %`).join(', ')}.`,
        'Template branches are the v-if, v-else, v-show and ternaries of the compiled templates; the last two columns are for information.',
        ...results.flatMap(({ area, files }) => [
            '',
            `<details><summary>${area}: ${new Set(files.map((file) => file.source.name)).size} file(s)</summary>`,
            '',
            ...table(
                ['File', ...METRICS.map((metric) => LABELS[metric].replace(/^./, (letter) => letter.toUpperCase()))],
                // One row per source file: a .vue file's <script> and template numbers side by side.
                [...new Set(files.map((file) => file.source.name))].map((name) => {
                    const numbers = emptyNumbers();
                    files.filter((file) => file.source.name === name).forEach((file) => add(numbers, file.numbers));
                    return [name, ...METRICS.map((metric) => show(numbers[metric]))];
                })
            ),
            '',
            '</details>'
        ]),
        '',
        `### Coverage ignore comments (${ignores.length})`,
        '',
        ...(ignores.length > 0 ? ignores.map((comment) => `- \`${comment.file}:${comment.line}\` \`${comment.text}\``) : ['None.']),
        '',
        `### Template exceptions (${exceptions.length})`,
        '',
        ...(exceptions.length > 0 ? exceptions.map((exception) => `- \`${exception.file}\` \`${exception.condition}\`: ${exception.reason}`) : ['None.']),
        ''
    ];
    fs.writeFileSync(SUMMARY_FILE, summary.join('\n'));

    console.log(areas.join('\n'));
    console.log(`\nHTML report: ${fromRoot(path.join(REPORT_DIR, 'index.html'))}, per file: ${fromRoot(SUMMARY_FILE)}`);
    if (problems.length > 0) console.log(`\n\`gate\` will fail on:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
};

// ---------------------------------------------------------------------------------------------
// gate

const baseOption = (args: string[]): string | undefined => {
    if (args.length === 0) return undefined;
    if (args.length !== 2 || args[0] !== '--base') throw new UsageError('The only option is --base <commit>.');
    return args[1];
};

const gateConfig = (args: string[]): void => {
    const base = baseOption(args);
    const THRESHOLDS = readThresholds();
    const problems = [...checkAgainstBase(base), ...readAreaConfigs(areaNames()).problems];
    console.log(`Thresholds for an enforced area: ${GATED.map((metric) => `${LABELS[metric]} >= ${THRESHOLDS[metric]} %`).join(', ')}.`);
    if (problems.length > 0) {
        console.log(`\nProblems:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
        process.exit(1);
    }
    console.log('The files of the coverage gate are in order.');
};

const gate = (args: string[]): void => {
    const base = baseOption(args);
    const THRESHOLDS = readThresholds();
    const merged = readMerged();
    const weaker = checkAgainstBase(base);
    const { results, problems: found } = measure(merged);
    const problems = [...weaker, ...found];
    const visits = fs.existsSync(ROUTE_VISITS_FILE) ? readJson<RouteVisits>(ROUTE_VISITS_FILE) : {};

    console.log(`Frontend coverage gate: ${GATED.map((metric) => `${LABELS[metric]} >= ${THRESHOLDS[metric]} %`).join(', ')}, every route opened by a behavioural test.\n`);
    const failed: string[] = [];
    for (const { area, config, numbers } of results) {
        const lines = GATED.map((metric) => {
            const below = config.gate === 'enforced' && percent(numbers[metric]) < THRESHOLDS[metric];
            const excepted = metric === 'templateBranches' && numbers.exceptedBranches > 0 ? `, ${numbers.exceptedBranches} left out by template exceptions` : '';
            return { below, text: `  ${LABELS[metric].padEnd(18)} ${show(numbers[metric])}${excepted}${below ? `  <- below ${THRESHOLDS[metric]} %` : ''}` };
        });
        const unvisited = config.gate === 'enforced'
            ? APP_ROUTES.filter((route) => route.area === area && !(visits[route.name]?.length > 0))
            : [];
        const ok = !lines.some((line) => line.below) && unvisited.length === 0;
        if (!ok) failed.push(area);

        console.log(`${area}: ${config.gate}${config.gate === 'enforced' ? `, ${ok ? 'passed' : 'FAILED'}` : ''}`);
        console.log(lines.map((line) => line.text).join('\n'));
        if (unvisited.length > 0) {
            console.log(`  routes that no behavioural test opened:\n${unvisited.map((route) => `    ${route.name} (${route.path})`).join('\n')}`);
        }
    }

    const pending = results.filter((result) => result.config.gate === 'pending').map((result) => result.area);
    console.log(`\nNot enforced yet (pending): ${pending.length > 0 ? pending.join(', ') : 'none'}`);
    if (problems.length > 0) console.log(`\nProblems:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
    if (failed.length > 0) console.log(`\nBelow the gate: ${failed.join(', ')}`);
    if (failed.length > 0 || problems.length > 0) process.exit(1);
    console.log('\nThe coverage gate passed.');
};

// ---------------------------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);
try {
    if (command === 'merge') await merge(args);
    else if (command === 'report' && args.length === 0) report();
    else if (command === 'gate') gate(args);
    else if (command === 'gate-config') gateConfig(args);
    else throw new UsageError('Usage: node scripts/coverage.ts merge [--raw <dir>…] [--routes <dir>…] [--build <dir>] | report | gate [--base <commit>] | gate-config [--base <commit>]');
} catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(error.message);
    process.exit(1);
}
