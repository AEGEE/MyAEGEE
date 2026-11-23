// Helpers every factory file uses: the response envelopes of the services, ids and dates.
//
// A factory returns a complete, realistic object, shaped like the real service's answer, and
// takes overrides for what a test cares about. Each one is checked against the real services
// in tests/<area>-contract.spec.ts. The rules are in docs/testing/writing-ui-specs.md.

export const DAY = 24 * 60 * 60 * 1000;

// Taken once, so every date of one run is relative to the same instant.
export const NOW = Date.now();

// The instant freezeTime() (ui/support/shell.ts) sets by default: a Monday morning in winter
// time (CET) in Brussels, the time zone the suite runs in.
export const FIXED_NOW = '2027-03-01T10:00:00+01:00';

// Dates are relative to now by default, so "open for applications" stays true whenever the
// tests run. Pass `Date.parse(FIXED_NOW)` as `from` in a spec that freezes the time.
export const iso = (offsetDays: number, from: number = NOW): string => new Date(from + offsetDays * DAY).toISOString();
export const date = (offsetDays: number, from: number = NOW): string => iso(offsetDays, from).slice(0, 10);

let nextId = 1000;
export const id = (): number => nextId++;

export interface Envelope<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: Record<string, unknown>;
    permissions?: unknown;
    errors?: Record<string, string[]>;
}

export interface ErrorEnvelope {
    success: false;
    message: string;
}

export const ok = <T>(data: T, extra: Partial<Envelope<T>> = {}): Envelope<T> => ({ success: true, data, ...extra });

// A page of a list: the rows and how many there are in total.
export const okList = <T>(rows: T[], count: number = rows.length): Envelope<T[]> => ok(rows, { meta: { count } });

// The bodies of the services' error answers (lib/errors.js in every service). The status is up
// to the test: `{ status: 422, json: validationError({ name: ['Name should be set.'] }) }`.

// 422 from a model validation: messages per field.
export const validationError = (errors: Record<string, string[]>) => ({ success: false as const, errors });

const failure = (message: string): ErrorEnvelope => ({ success: false, message });

// 422 with one message instead of messages per field.
export const unprocessable = failure;
// 400
export const badRequest = failure;
// 403
export const forbidden = failure;
// 404
export const notFound = failure;
