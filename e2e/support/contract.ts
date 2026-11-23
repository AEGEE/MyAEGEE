// Checks an object built by a mock factory (ui/support/factories/) against what a real service
// answered, so the mocks of the mocked-API suite can't drift away from the APIs unnoticed.
// Used by tests/<area>-contract.spec.ts.
import { expect } from '@playwright/test';

export const typeOf = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

// Paths in `expected` that `actual` doesn't have, or has with another type. null on either side
// matches anything (nullable fields), and arrays are compared by their first element. So give
// both sides real values where you can: a field that is null or an empty list isn't compared.
export const differences = (expected: unknown, actual: unknown, at = '$'): string[] => {
    if (expected === null || actual === null || expected === undefined) return [];
    if (typeOf(expected) !== typeOf(actual)) return [`${at}: factory has ${typeOf(expected)}, service has ${typeOf(actual)}`];
    if (Array.isArray(expected)) {
        return expected.length && (actual as unknown[]).length ? differences(expected[0], (actual as unknown[])[0], `${at}[0]`) : [];
    }
    if (typeof expected === 'object') {
        return Object.entries(expected as Record<string, unknown>).flatMap(([key, value]) => (key in (actual as object)
            ? differences(value, (actual as Record<string, unknown>)[key], `${at}.${key}`)
            : [`${at}.${key}: missing in the service's response`]));
    }
    return [];
};

// Every field the factory builds has to exist in the real response with the same type; the
// real response may have more fields. `name` is the factory's export name: `npm run lint`
// (scripts/check-factory-contracts.ts) looks for `expectShape('<name>'` to see that every
// factory is checked. `ignore` lists paths (`$.set_board_comment`) to leave out.
export const expectShape = (name: string, expected: unknown, actual: unknown, { ignore = [] as string[] } = {}): void => {
    expect(actual, `${name}: the service answered with data`).toBeTruthy();
    const found = differences(expected, actual).filter((difference) => !ignore.some((path) => difference.startsWith(`${path}:`) || difference.startsWith(`${path}.`)));
    expect(found, `${name}: factory vs. real response`).toEqual([]);
};
