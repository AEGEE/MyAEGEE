// The coverage gate may not get weaker unnoticed. This compares what the gate is made of with
// the same files at a base commit (in CI the merge base with `stable`) and finds every
// downgrade:
//   - an area that was `enforced` is `pending` again, or lost its file;
//   - a template exception was added to an area that was enforced;
//   - a file of an area that was enforced got another istanbul ignore comment, or its comments
//     take more lines of code out of the numbers than before (one comment swapped for a wider one);
//   - a threshold was lowered.
// A downgrade fails the gate unless ui/support/coverage/downgrades.json accepts it with a
// reason. Every downgrade is printed with the prefix COVERAGE-DOWNGRADE:, accepted or not.
//
// An area that isn't enforced at the base has no gate to weaken: the exceptions and ignore
// comments that come with enforcing it are reviewed with that change. They are printed with
// the prefix COVERAGE-EXCEPTION-ADDED: and need no entry in downgrades.json.
//
// Used by scripts/coverage.ts (`gate` and `gate-config`). See docs/testing/coverage.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { ignoredCode } from './check-ignores.ts';
import { reasonProblem } from './reason.ts';

export const DEFAULT_BRANCH = 'stable';

// From the repository root.
export const AREA_CONFIG_PATH = 'e2e/ui/support/coverage';
export const THRESHOLDS_FILE = 'thresholds.json';
export const DOWNGRADES_FILE = 'downgrades.json';
// The files in the directory of the area files that are not an area's.
export const NOT_AREA_FILES = [THRESHOLDS_FILE, DOWNGRADES_FILE];

const SRC_PATH = 'frontend/src';

export const GATED_METRICS = ['scriptLines', 'scriptBranches', 'templateBranches'] as const;
export type GatedMetric = typeof GATED_METRICS[number];
export type Thresholds = Record<GatedMetric, number>;

export const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

// views/<area>/… belongs to that area, everything else in frontend/src to the shell.
export const areaOfFile = (name: string): string => name.match(/^views\/([^/]+)\//)?.[1] ?? 'shell';

// ---------------------------------------------------------------------------------------------
// what the gate is made of, in the working tree or at a commit

// The files of a checkout: the working tree, or a commit read through git.
export interface Tree {
    // The content of a file by its path from the repository root, or undefined without one.
    read(file: string): string | undefined;
    // The names of the files in a directory.
    list(directory: string): string[];
}

export interface GateState {
    // By area: its gate and the template exceptions it has. An area without a file is not here.
    areas: Record<string, { gate: 'pending' | 'enforced'; exceptions: { file: string; condition: string }[] }>;
    // Undefined where the thresholds file doesn't exist (yet).
    thresholds: Partial<Thresholds> | undefined;
    // Per file with ignore comments, by its path from the repository root: how many it has, and
    // how many lines of code they take out of the numbers together.
    ignores: Record<string, { comments: number; lines: number }>;
    // The text of downgrades.json, if there is one.
    downgrades: string | undefined;
}

const parse = (text: string | undefined): unknown => {
    if (text === undefined) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        // What is wrong with the files of the working tree is reported where they are read
        // for the gate itself (scripts/coverage.ts); a broken file at the base has nothing to compare.
        return undefined;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// `ignoreFiles` are the files to count ignore comments in. Only files that have one in the
// working tree can have gained one, so both sides are read for those.
export const readGateState = (tree: Tree, ignoreFiles: string[]): GateState => {
    const areas: GateState['areas'] = {};
    for (const name of tree.list(AREA_CONFIG_PATH).filter((file) => file.endsWith('.json') && !NOT_AREA_FILES.includes(file)).sort()) {
        const config = parse(tree.read(`${AREA_CONFIG_PATH}/${name}`));
        if (!isRecord(config)) continue;
        const exceptions = Array.isArray(config.templateExceptions) ? config.templateExceptions : [];
        areas[name.replace(/\.json$/, '')] = {
            gate: config.gate === 'enforced' ? 'enforced' : 'pending',
            exceptions: exceptions
                .filter((exception): exception is { file: string; condition: string } => isRecord(exception) && typeof exception.file === 'string' && typeof exception.condition === 'string')
                .map(({ file, condition }) => ({ file, condition: squash(condition) }))
        };
    }

    const given = parse(tree.read(`${AREA_CONFIG_PATH}/${THRESHOLDS_FILE}`));
    const thresholds = isRecord(given)
        ? Object.fromEntries(GATED_METRICS.filter((metric) => typeof given[metric] === 'number').map((metric) => [metric, given[metric]])) as Partial<Thresholds>
        : undefined;

    const ignores: GateState['ignores'] = {};
    for (const file of ignoreFiles) {
        const ignored = ignoredCode(tree.read(file) ?? '', file.endsWith('.vue'));
        if (ignored.comments > 0) ignores[file] = ignored;
    }

    return { areas, thresholds, ignores, downgrades: tree.read(`${AREA_CONFIG_PATH}/${DOWNGRADES_FILE}`) };
};

// ---------------------------------------------------------------------------------------------
// downgrades

export type Downgrade =
    | { change: 'pending'; area: string }
    | { change: 'exception'; area: string; file: string; condition: string }
    | { change: 'ignore'; area: string; file: string; from: { comments: number; lines: number }; to: { comments: number; lines: number } }
    | { change: 'threshold'; metric: GatedMetric; from: number; to: number | undefined };

const CHANGES = ['pending', 'exception', 'ignore', 'threshold'] as const;

// What an entry of downgrades.json names, and what identifies a downgrade.
const keyOf = (item: { change: string; area?: string; file?: string; condition?: string; metric?: string }): string => {
    if (item.change === 'pending') return `pending ${item.area}`;
    if (item.change === 'exception') return `exception ${item.file} ${squash(item.condition ?? '')}`;
    if (item.change === 'ignore') return `ignore ${item.file}`;
    return `threshold ${item.metric}`;
};

const ignoredText = ({ comments, lines }: { comments: number; lines: number }): string => `${comments} istanbul ignore comment(s) over ${lines} line(s)`;

export const describe = (downgrade: Downgrade): string => {
    if (downgrade.change === 'pending') return `the area ${downgrade.area} was enforced and is pending now`;
    if (downgrade.change === 'exception') return `new template exception in the enforced area ${downgrade.area}: \`${downgrade.condition}\` in ${downgrade.file}`;
    if (downgrade.change === 'ignore') return `${downgrade.file} (enforced area ${downgrade.area}) has ${ignoredText(downgrade.to)}, it had ${ignoredText(downgrade.from)}`;
    return `the threshold ${downgrade.metric} is ${downgrade.to === undefined ? 'gone' : `${downgrade.to} %`}, it was ${downgrade.from} %`;
};

// How an entry of downgrades.json for it looks, without the reason.
const entryFor = (downgrade: Downgrade): string => {
    if (downgrade.change === 'pending') return `{ "change": "pending", "area": "${downgrade.area}", "reason": "…" }`;
    if (downgrade.change === 'exception') return `{ "change": "exception", "file": ${JSON.stringify(downgrade.file)}, "condition": ${JSON.stringify(downgrade.condition)}, "reason": "…" }`;
    if (downgrade.change === 'ignore') return `{ "change": "ignore", "file": "${downgrade.file}", "reason": "…" }`;
    return `{ "change": "threshold", "metric": "${downgrade.metric}", "reason": "…" }`;
};

export interface Comparison {
    downgrades: Downgrade[];
    // New exceptions and ignore comments in areas that were not enforced at the base: for the
    // reviewer, not a downgrade.
    added: string[];
}

export const findDowngrades = (base: GateState, head: GateState): Comparison => {
    const downgrades: Downgrade[] = [];
    const added: string[] = [];
    const wasEnforced = (area: string): boolean => base.areas[area]?.gate === 'enforced';

    for (const area of Object.keys(base.areas).sort()) {
        if (wasEnforced(area) && head.areas[area]?.gate !== 'enforced') downgrades.push({ change: 'pending', area });
    }

    for (const [area, { exceptions }] of Object.entries(head.areas).sort(([a], [b]) => a.localeCompare(b))) {
        const before = new Set((base.areas[area]?.exceptions ?? []).map((exception) => keyOf({ change: 'exception', ...exception })));
        for (const exception of exceptions) {
            if (before.has(keyOf({ change: 'exception', ...exception }))) continue;
            if (wasEnforced(area)) downgrades.push({ change: 'exception', area, ...exception });
            else added.push(`template exception in ${area}: \`${exception.condition}\` in ${exception.file}`);
        }
    }

    for (const [file, to] of Object.entries(head.ignores).sort(([a], [b]) => a.localeCompare(b))) {
        const from = base.ignores[file] ?? { comments: 0, lines: 0 };
        // More comments, or the same number that covers more code than before.
        if (to.comments <= from.comments && to.lines <= from.lines) continue;
        const area = areaOfFile(path.posix.relative(SRC_PATH, file));
        if (wasEnforced(area)) downgrades.push({ change: 'ignore', area, file, from, to });
        else added.push(`istanbul ignore comment in ${area}: ${file} has ${ignoredText(to)}, it had ${ignoredText(from)}`);
    }

    for (const metric of GATED_METRICS) {
        const from = base.thresholds?.[metric];
        const to = head.thresholds?.[metric];
        if (from !== undefined && (to === undefined || to < from)) downgrades.push({ change: 'threshold', metric, from, to });
    }

    return { downgrades, added };
};

// ---------------------------------------------------------------------------------------------
// accepted downgrades (downgrades.json)

export interface AcceptedDowngrade {
    change: typeof CHANGES[number];
    area?: string;
    file?: string;
    condition?: string;
    metric?: string;
    reason: string;
}

const NAMES: Record<AcceptedDowngrade['change'], (keyof AcceptedDowngrade)[]> = {
    pending: ['area'],
    exception: ['file', 'condition'],
    ignore: ['file'],
    threshold: ['metric']
};

// The entries of a downgrades.json that are well-formed, and what is wrong with the others.
export const parseAccepted = (text: string | undefined): { entries: AcceptedDowngrade[]; problems: string[] } => {
    if (text === undefined) return { entries: [], problems: [] };
    const where = `${AREA_CONFIG_PATH}/${DOWNGRADES_FILE}`;
    let list: unknown;
    try {
        list = JSON.parse(text);
    } catch (error) {
        return { entries: [], problems: [`${where} is not valid JSON: ${(error as Error).message}`] };
    }
    if (!Array.isArray(list)) return { entries: [], problems: [`${where} has to be a list of accepted downgrades`] };

    const problems: string[] = [];
    const entries = list.filter((entry: unknown, index): entry is AcceptedDowngrade => {
        const label = `${where}: entry ${index + 1}`;
        if (!isRecord(entry) || !(CHANGES as readonly unknown[]).includes(entry.change)) {
            problems.push(`${label} needs a "change": ${CHANGES.map((change) => `"${change}"`).join(', ')}`);
            return false;
        }
        const names = NAMES[entry.change as AcceptedDowngrade['change']];
        const missing = names.filter((name) => typeof entry[name] !== 'string' || entry[name].trim() === '');
        const extra = Object.keys(entry).filter((key) => !['change', 'reason', ...names].includes(key));
        if (missing.length > 0 || extra.length > 0) {
            problems.push(`${label} ("${entry.change}") takes ${[...names, 'reason'].map((name) => `"${name}"`).join(', ')} and nothing else`);
            return false;
        }
        const problem = typeof entry.reason === 'string' ? reasonProblem(entry.reason, { not: names.map((name) => entry[name] as string) }) : 'is missing';
        if (problem) {
            problems.push(`${label}: the reason ${problem}`);
            return false;
        }
        return true;
    });
    return { entries, problems };
};

export interface Verdict {
    accepted: { downgrade: Downgrade; reason: string }[];
    refused: Downgrade[];
    // Entries that are new in this change and match none of its downgrades.
    unused: AcceptedDowngrade[];
    // Entries the base has too. They accept nothing any more.
    leftover: AcceptedDowngrade[];
}

// An entry only counts for the change that adds it: one that the base has as well was for an
// earlier downgrade, and must not accept the same one when it happens again.
export const judge = (downgrades: Downgrade[], entries: AcceptedDowngrade[], baseEntries: AcceptedDowngrade[]): Verdict => {
    const same = (entry: AcceptedDowngrade): string => `${keyOf(entry)} ${squash(entry.reason)}`;
    const old = new Set(baseEntries.map(same));
    const active = entries.filter((entry) => !old.has(same(entry)));
    const used = new Set<AcceptedDowngrade>();
    const verdict: Verdict = { accepted: [], refused: [], unused: [], leftover: entries.filter((entry) => old.has(same(entry))) };

    for (const downgrade of downgrades) {
        const entry = active.find((item) => keyOf(item) === keyOf(downgrade));
        if (entry) {
            used.add(entry);
            verdict.accepted.push({ downgrade, reason: squash(entry.reason) });
        } else {
            verdict.refused.push(downgrade);
        }
    }
    verdict.unused = active.filter((entry) => !used.has(entry));
    return verdict;
};

// ---------------------------------------------------------------------------------------------
// the base to compare with

// Runs git and returns what it prints, or undefined when it fails.
export type Git = (args: string[]) => string | undefined;

export type Base = { ref: string; from: string } | { problem: string };

// The commit to compare with: the one given, in CI on the default branch the commit before
// (what the push changed), otherwise where the branch left the default branch.
export const resolveBase = (explicit: string | undefined, env: Record<string, string | undefined>, git: Git): Base => {
    const commit = (ref: string): string | undefined => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])?.trim() || undefined;

    if (explicit) {
        const ref = commit(explicit);
        return ref ? { ref, from: `--base ${explicit}` } : { problem: `--base ${explicit} is not a commit of this repository` };
    }

    const branch = env.CIRCLE_BRANCH ?? env.GITHUB_REF_NAME;
    if (env.CI && branch === DEFAULT_BRANCH) {
        const ref = commit('HEAD~1');
        return ref ? { ref, from: `the commit before this one on ${DEFAULT_BRANCH}` } : { problem: 'HEAD~1 is not there: the checkout needs the history' };
    }

    const remote = `origin/${DEFAULT_BRANCH}`;
    if (!commit(remote)) return { problem: `${remote} is not there: fetch it (\`git fetch origin ${DEFAULT_BRANCH}\`), or give a commit with --base` };
    const ref = git(['merge-base', 'HEAD', remote])?.trim();
    return ref ? { ref, from: `the merge base with ${remote}` } : { problem: `HEAD and ${remote} have no common commit: the checkout needs the history, or give a commit with --base` };
};

// ---------------------------------------------------------------------------------------------
// the check

export const gitIn = (root: string): Git => (args) => {
    try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    } catch {
        return undefined;
    }
};

export const workingTree = (root: string): Tree => ({
    read: (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : undefined),
    list: (directory) => (fs.existsSync(path.join(root, directory)) ? fs.readdirSync(path.join(root, directory)) : [])
});

export const commitTree = (git: Git, ref: string): Tree => ({
    read: (file) => git(['show', `${ref}:${file}`]),
    list: (directory) => (git(['ls-tree', '--name-only', ref, `${directory}/`]) ?? '').split('\n').filter((line) => line !== '').map((line) => path.posix.basename(line))
});

export interface ConfigCheck {
    // What to print.
    lines: string[];
    // What fails the gate.
    problems: string[];
}

// Compares the working tree (`head`) with a base. `ignoreFiles` as for readGateState.
export const compareWithBase = (head: Tree, base: Tree, ignoreFiles: string[]): ConfigCheck => {
    const now = readGateState(head, ignoreFiles);
    const before = readGateState(base, ignoreFiles);
    const { downgrades, added } = findDowngrades(before, now);
    const { entries, problems } = parseAccepted(now.downgrades);
    const { accepted, refused, unused, leftover } = judge(downgrades, entries, parseAccepted(before.downgrades).entries);

    const where = `${AREA_CONFIG_PATH}/${DOWNGRADES_FILE}`;
    const lines = [
        ...accepted.map(({ downgrade, reason }) => `COVERAGE-DOWNGRADE: ${describe(downgrade)}. Accepted in ${DOWNGRADES_FILE}: ${reason}`),
        ...refused.map((downgrade) => `COVERAGE-DOWNGRADE: ${describe(downgrade)}. NOT ACCEPTED`),
        ...added.map((text) => `COVERAGE-EXCEPTION-ADDED: ${text}`),
        ...leftover.map((entry) => `${where}: the entry for "${keyOf(entry)}" is from an earlier change and accepts nothing any more: remove it`)
    ];
    return {
        lines,
        problems: [
            ...problems,
            ...refused.map((downgrade) => `${describe(downgrade)}. Undo it, or accept it in ${where} with a reason: ${entryFor(downgrade)}`),
            ...unused.map((entry) => `${where}: the entry for "${keyOf(entry)}" matches no downgrade in this change: remove it`)
        ]
    };
};
