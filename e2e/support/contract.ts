// Checks an object built by a mock factory (ui/support/factories/) against what a real service
// answered, so the mocks of the mocked-API suite can't drift away from the APIs unnoticed.
// Used by tests/<area>-contract.spec.ts.
//
// A field can only be compared when both sides have a value: null on either side says nothing
// about the type, and neither does an empty list about its elements. Such a field is not passed
// over in silence: by the end of the test every path of a factory has been compared in one of
// the test's `expectShape` calls, or is listed as a gap with the reason nobody can fill it
// (`gaps`). The fixtures of support/api.ts do that check (`contractCheck`).
import { expect } from '@playwright/test';

import { reasonProblem } from '../scripts/reason.ts';

export const typeOf = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

export interface Comparison {
    // Paths the service lacks, or has with another type.
    differences: string[];
    // Paths whose type was compared (both sides had a value).
    compared: Set<string>;
    // Paths that could not be compared, with what was in the way.
    uncompared: Map<string, string>;
}

// Walks `expected` (the factory's object): every field it has must exist in `actual` with the
// same type. The real answer may have more fields. Lists are compared by their first element.
export const compare = (expected: unknown, actual: unknown, at = '$', into: Comparison = { differences: [], compared: new Set(), uncompared: new Map() }): Comparison => {
    // An optional field the factory leaves out.
    if (expected === undefined) return into;
    if (expected === null || actual === null) {
        into.uncompared.set(at, expected === null ? 'null in the factory' : 'null in the service\'s answer');
        return into;
    }
    if (typeOf(expected) !== typeOf(actual)) {
        into.differences.push(`${at}: factory has ${typeOf(expected)}, service has ${typeOf(actual)}`);
        return into;
    }

    into.compared.add(at);
    if (Array.isArray(expected)) {
        const real = actual as unknown[];
        if (expected.length && real.length) compare(expected[0], real[0], `${at}[0]`, into);
        else into.uncompared.set(`${at}[0]`, expected.length ? 'an empty list in the service\'s answer' : 'an empty list in the factory');
    } else if (typeof expected === 'object') {
        for (const [key, value] of Object.entries(expected as Record<string, unknown>)) {
            if (key in (actual as object)) compare(value, (actual as Record<string, unknown>)[key], `${at}.${key}`, into);
            else if (value !== undefined) into.differences.push(`${at}.${key}: missing in the service's response`);
        }
    }
    return into;
};

// Paths in `expected` that `actual` doesn't have, or has with another type.
export const differences = (expected: unknown, actual: unknown): string[] => compare(expected, actual).differences;

export interface ShapeOptions {
    // Paths that are left out altogether, with the reason: `{ '$.set_board_comment': 'its keys
    // are the ids of the user\'s bodies' }`. For parts whose shape depends on the data.
    ignore?: Record<string, string>;
    // Paths that stay uncompared in this test because nobody can give both sides a value, with
    // the reason: `{ '$.deleted_at': 'core never sends a deleted member' }`. A gap that turns
    // out to be compared fails the test, so the list can't outlive its reasons.
    gaps?: Record<string, string>;
}

interface Checked {
    compared: Set<string>;
    uncompared: Map<string, string>;
    gaps: Map<string, string>;
}

// What the `expectShape` calls of the running test found, by factory name. Tests of the real
// stack run one at a time in a worker, so one list is enough.
const checked = new Map<string, Checked>();

const within = (path: string, parent: string): boolean => path === parent || path.startsWith(`${parent}.`) || path.startsWith(`${parent}[`);

// Every field the factory builds has to exist in the real response with the same type; the
// real response may have more fields. `name` is the factory's export name: `npm run lint`
// (scripts/check-factory-contracts.ts) looks for `expectShape('<name>'` to see that every
// factory is checked. Give both sides real values: a field that is null or an empty list on
// one side is not compared, and has to be compared by another call in the same test or be
// listed in `gaps`.
export const expectShape = (name: string, expected: unknown, actual: unknown, { ignore = {}, gaps = {} }: ShapeOptions = {}): void => {
    for (const [path, reason] of [...Object.entries(ignore), ...Object.entries(gaps)]) {
        const problem = reasonProblem(reason);
        expect(problem, `${name}: the reason for leaving out ${path} ("${reason}") ${problem}`).toBeUndefined();
    }
    expect(actual, `${name}: the service answered with data`).toBeTruthy();

    const ignored = Object.keys(ignore);
    const result = compare(expected, actual);
    const found = result.differences.filter((difference) => !ignored.some((path) => within(difference.slice(0, difference.indexOf(': ')), path)));
    expect(found, `${name}: factory vs. real response`).toEqual([]);

    const entry = checked.get(name) ?? { compared: new Set<string>(), uncompared: new Map<string, string>(), gaps: new Map<string, string>() };
    checked.set(name, entry);
    for (const path of result.compared) if (!ignored.some((parent) => within(path, parent))) entry.compared.add(path);
    for (const [path, why] of result.uncompared) if (!ignored.some((parent) => within(path, parent))) entry.uncompared.set(path, why);
    for (const [path, reason] of Object.entries(gaps)) entry.gaps.set(path, reason);
};

// Forgets what earlier tests compared. Called before every test.
export const startContractCheck = (): void => checked.clear();

// What the test left unchecked: paths that no `expectShape` call of the test could compare and
// that are not listed as a gap, and gaps that are not gaps any more.
export const contractProblems = (): string[] => [...checked].flatMap(([name, { compared, uncompared, gaps }]) => [
    ...[...uncompared]
        .filter(([path]) => !compared.has(path) && ![...gaps.keys()].some((gap) => within(path, gap)))
        .map(([path, why]) => `${name} ${path} was never compared (${why}): give both sides a value, or list it in \`gaps\` with the reason`),
    ...[...gaps.keys()]
        .filter((gap) => compared.has(gap))
        .map((gap) => `${name} ${gap} is listed as a gap, but both sides have a value now: remove it from \`gaps\``),
    ...[...gaps.keys()]
        .filter((gap) => !compared.has(gap) && ![...uncompared.keys()].some((path) => within(path, gap)))
        .map((gap) => `${name} ${gap} is listed as a gap, but the factory has no such field: remove it from \`gaps\``)
]);
