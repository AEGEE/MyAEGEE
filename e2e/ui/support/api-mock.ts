// Answers the frontend's /api calls inside the browser (a route on the browser context, so
// every page and popup of the test is covered), so the mocked-API suite needs no backend. Tests
// register handlers with `on()`; the last matching handler wins, so a test can override the
// defaults. Every request is recorded for assertions.
//
// Paths are written like express routes without the /api prefix: 'GET events /single/:id'.
// Requests outside /api (calendar and Jira proxies, media files, other hosts) are answered
// with `url()`. A route that can't match anything (a typo in the method, the service or the
// path) throws where it is written, and a handler that no request ever matched fails the test
// unless it says why that is fine (`optional`).
// How to use all of it: docs/testing/writing-ui-specs.md.
import type { BrowserContext, Request, Route } from '@playwright/test';

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type Method = typeof METHODS[number];

// The services behind /api (frontend/src/services.json).
export const SERVICES = ['core', 'events', 'summeruniversity', 'statutory', 'discounts', 'network', 'mailer'] as const;

// Requests to these hosts reach the suite's own server; everything else is blocked unless a
// test answers it with `url()`.
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

// One part of a multipart/form-data body.
export interface FormPart {
    name: string;
    // Set for file parts.
    filename?: string;
    contentType?: string;
    // The text of a part that isn't a file.
    value?: string;
}

export interface MockRequest {
    method: Method;
    // The service of an /api call ('core', 'events', ...), or 'url' for anything else.
    service: string;
    // The path inside the service ('/single/1'); for `url()` handlers the full URL.
    path: string;
    params: Record<string, string>;
    query: URLSearchParams;
    // The parsed JSON body, the text of another body, or undefined.
    body: unknown;
    // The body as it was sent.
    raw: Buffer | null;
    contentType: string | null;
    // The parts of a multipart/form-data body (file uploads), otherwise empty.
    parts: FormPart[];
    headers: Record<string, string>;
}

export interface MockResponse {
    status?: number;
    json?: unknown;
    // A body that isn't JSON (a download, HTML, an iCal file), with its content type.
    body?: Buffer | string;
    contentType?: string;
    headers?: Record<string, string>;
    // Fail the request on the network level instead of answering it ('failed', 'timedout', ...).
    abort?: string;
    // Waits this long before answering, to see loading states.
    delayMs?: number;
}

export type Responder = MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>);

export interface HandlerOptions {
    // Why it is fine when no request ever matches this handler (a page that asks only in some
    // runs, a default of a shared `beforeEach`). Without it, a handler nobody called fails the test.
    optional?: string;
}

interface Handler {
    // The route as the test wrote it: 'GET events /single/:id', 'GET url /media/**'.
    route: string;
    method: Method | '*';
    service: string;
    pattern: RegExp;
    keys: string[];
    respond: Responder;
    fallback: boolean;
    optional: boolean;
    // A later handler for exactly the same route took its place.
    replaced: boolean;
    matched: number;
}

export interface RecordedCall extends MockRequest {
    // 0 for an aborted request.
    status: number;
    handled: boolean;
}

const compile = (path: string): { pattern: RegExp; keys: string[] } => {
    const keys: string[] = [];
    if (path === '*') return { pattern: /^.*$/, keys };
    const source = path
        .replace(/\/$/, '')
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:(\w+)/g, (_, key: string) => { keys.push(key); return '([^/]+)'; });
    return { pattern: new RegExp(`^${source}/?$`), keys };
};

// '/services/calendar-cors/**' or 'https://api.github.com/**': `**` is anything, `*` anything
// but a slash. A path pattern is for this origin, with any query string.
const compileGlob = (glob: string): RegExp => {
    const source = glob.split('**')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
        .join('.*');
    return new RegExp(glob.startsWith('/') ? `^https?://[^/]+${source}(\\?.*)?$` : `^${source}$`);
};

const MIN_REASON_WORDS = 3;

const routeError = (route: string, problem: string): Error => {
    const error = new Error(`"${route}" is not a route the API mock can match: ${problem}\nWrite 'METHOD service /path/:param', for example 'GET events /single/:id', or 'GET url /services/calendar-cors/**' for a request outside /api.`);
    error.name = 'RouteError';
    return error;
};

const distance = (a: string, b: string): number => {
    let row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const next = [i];
        for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        row = next;
    }
    return row[b.length];
};

// The candidate a typo most likely stands for, if one is near enough.
const closest = (word: string, candidates: readonly string[]): string | undefined => {
    const lower = word.toLowerCase().replace(/[^a-z]/g, '');
    const [best] = candidates.map((candidate) => ({ candidate, by: distance(lower, candidate.toLowerCase()) })).sort((a, b) => a.by - b.by);
    return best && best.by <= 2 ? best.candidate : undefined;
};

// Takes a route apart and refuses what could never match a request: `get events /`,
// `GET events/`, `POST evnts /`, `GET events single/1`, `GET events /api/events/`, `GET events /?x=1`.
// A route that is wrong matches nothing, and a test that asserts "no call was made" with it
// would pass for the wrong reason.
export const parseRoute = (route: string): { method: Method | '*'; service: string; path: string } => {
    if (typeof route !== 'string' || route !== route.trim() || route === '') throw routeError(String(route), 'it is empty or has spaces around it.');
    const parts = route.split(' ');
    if (parts.length !== 3 || parts.some((part) => part === '')) {
        throw routeError(route, `it needs three parts separated by one space each (method, service, path), and has ${parts.filter((part) => part !== '').length}.`);
    }
    const [method, service, path] = parts;

    if (method !== '*' && !(METHODS as readonly string[]).includes(method)) {
        const meant = closest(method, METHODS);
        throw routeError(route, `the method "${method}" is not one of ${METHODS.join(', ')} or *.${meant ? ` Did you mean ${meant}?` : ''}`);
    }
    const services = [...SERVICES, 'url', '*'];
    if (!services.includes(service)) {
        const meant = closest(service, SERVICES);
        throw routeError(route, `the service "${service}" is not one of ${SERVICES.join(', ')} (or url, or *).${meant ? ` Did you mean ${meant}?` : ''}`);
    }

    if (service === 'url') {
        if (!/^(\/|https?:\/\/)/.test(path)) throw routeError(route, 'a url pattern starts with / (this origin) or with http:// or https:// (another host).');
        return { method: method as Method | '*', service, path };
    }
    if (path === '*') return { method: method as Method | '*', service, path };
    if (!path.startsWith('/')) throw routeError(route, `the path "${path}" has to start with a slash.`);
    if (/^\/api(\/|$)/.test(path)) throw routeError(route, 'the path is written without the /api/<service> prefix.');
    if (/[?#]/.test(path)) throw routeError(route, 'the path has no query string or hash: every query matches, read it in the responder (`({ query }) => …`) or from the recorded call.');
    if (path.includes('//')) throw routeError(route, 'the path has an empty segment (//).');
    if (path.includes('*')) throw routeError(route, 'a path is either * (everything of the service) or has :parameters; * inside a path matches nothing.');
    if (/:(?!\w)/.test(path) || /[^/]:\w/.test(path)) throw routeError(route, 'a :parameter is a whole path segment with a name, like /single/:id.');
    return { method: method as Method | '*', service, path };
};

const parseParts = (raw: Buffer, contentType: string): FormPart[] => {
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundary) return [];
    const delimiter = `--${boundary[1] ?? boundary[2]}`;
    // Headers are ASCII and latin1 keeps one character per byte, so file contents can't break the split.
    return raw.toString('latin1').split(delimiter).slice(1, -1).map((section) => {
        const [head, ...rest] = section.replace(/^\r\n/, '').split('\r\n\r\n');
        const content = rest.join('\r\n\r\n').replace(/\r\n$/, '');
        const disposition = head.match(/content-disposition:[^\r\n]*/i)?.[0] ?? '';
        const filename = disposition.match(/filename="([^"]*)"/)?.[1];
        const part: FormPart = { name: disposition.match(/\bname="([^"]*)"/)?.[1] ?? '' };
        const type = head.match(/content-type:\s*([^\r\n]+)/i)?.[1];
        if (type) part.contentType = type;
        if (filename !== undefined) part.filename = Buffer.from(filename, 'latin1').toString('utf8');
        else part.value = Buffer.from(content, 'latin1').toString('utf8');
        return part;
    });
};

const describeRequest = (request: Request, service: string, path: string, url: URL): Omit<MockRequest, 'params'> => {
    const headers = request.headers();
    const contentType = headers['content-type'] ?? null;
    const raw = request.postDataBuffer();
    const multipart = !!raw && !!contentType && contentType.startsWith('multipart/form-data');
    let body: unknown;
    if (raw && !multipart) {
        const text = raw.toString('utf8');
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    return {
        method: request.method() as Method,
        service,
        path,
        query: url.searchParams,
        body,
        raw,
        contentType,
        parts: multipart ? parseParts(raw, contentType) : [],
        headers
    };
};

export class ApiMock {
    readonly calls: RecordedCall[] = [];

    private readonly handlers: Handler[] = [];

    private registeringFallbacks = false;

    private context: BrowserContext | undefined;

    private add(route: string, method: Method | '*', service: string, compiled: { pattern: RegExp; keys: string[] }, respond: Responder, options: HandlerOptions): void {
        if (options.optional !== undefined && String(options.optional).split(/\s+/).filter((word) => /\w/.test(word)).length < MIN_REASON_WORDS) {
            throw new Error(`"${route}": \`optional\` says why no request may match the handler, in at least ${MIN_REASON_WORDS} words.`);
        }
        for (const earlier of this.handlers) {
            if (earlier.route === route && earlier.fallback === this.registeringFallbacks) earlier.replaced = true;
        }
        this.handlers.push({
            route,
            method,
            service,
            ...compiled,
            respond,
            fallback: this.registeringFallbacks,
            optional: this.registeringFallbacks || options.optional !== undefined,
            replaced: false,
            matched: 0
        });
    }

    // 'GET events /single/:id' or 'GET events *'. A responder can be a fixed response or a function.
    // The page has to make a request that the handler answers, or the test fails: pass
    // `{ optional: '<why the page may not ask>' }` where that is expected.
    on(route: string, respond: Responder, options: HandlerOptions = {}): this {
        const { method, service, path } = parseRoute(route);
        if (service === 'url') throw routeError(route, 'answer requests outside /api with `api.url(method, glob, respond)`.');
        this.add(route, method, service, compile(path), respond, options);
        return this;
    }

    // Shorthand for a 200 with this JSON body.
    json(route: string, json: unknown, options: HandlerOptions = {}): this {
        return this.on(route, { json }, options);
    }

    // Answers requests outside /api: a path glob for this origin ('/services/calendar-cors/**',
    // '/media/**') or a full URL glob for another host ('https://api.github.com/**'). Recorded
    // with service 'url' and the full URL as path: `api.callsTo('GET url /services/calendar-cors/**')`.
    url(method: Method | '*', glob: string, respond: Responder, options: HandlerOptions = {}): this {
        const route = `${method} url ${glob}`;
        parseRoute(route);
        const pattern = compileGlob(glob);
        this.add(route, method, 'url', { pattern, keys: [] }, respond, options);
        // Routes added later win over the earlier ones, so over the block on other hosts too.
        this.routeUrl(pattern);
        return this;
    }

    // Handlers registered inside `register` only answer what no other handler matches, in
    // whatever order they are added, and nothing has to call them. For a spec that ends on
    // another area's page: that page gets generic answers (`api.fallback(mockEverything)`) while
    // the page under test stays strict.
    fallback(register: (api: ApiMock) => void): this {
        const before = this.registeringFallbacks;
        this.registeringFallbacks = true;
        try {
            register(this);
        } finally {
            this.registeringFallbacks = before;
        }
        return this;
    }

    // Calls that matched no handler: the test forgot to mock them.
    get unhandled(): RecordedCall[] {
        return this.calls.filter((call) => !call.handled);
    }

    // The routes of handlers that no request matched, although the test registered them as
    // something the page asks for: a typo in a path, or a page that stopped asking.
    get unused(): string[] {
        return this.handlers.filter((handler) => !handler.optional && !handler.replaced && handler.matched === 0).map((handler) => handler.route);
    }

    // Recorded calls matching 'METHOD service /path/:param', or 'METHOD url <glob>'.
    callsTo(route: string): RecordedCall[] {
        const { method, service, path } = parseRoute(route);
        const pattern = service === 'url' ? compileGlob(path) : compile(path).pattern;
        return this.calls.filter((call) => (method === '*' || call.method === method) && (service === '*' ? call.service !== 'url' : call.service === service) && pattern.test(call.path));
    }

    // Answers for every page of the browser context, the ones a test opens itself included.
    async install(context: BrowserContext): Promise<void> {
        this.context = context;
        // Fonts and map tiles come from the internet; the tests don't need them. A test that
        // needs an answer from another host gives one with `url()`.
        await context.route((requestUrl) => !LOCAL_HOSTS.includes(requestUrl.hostname), (route) => route.abort());
        await context.route((requestUrl) => LOCAL_HOSTS.includes(requestUrl.hostname) && requestUrl.pathname.startsWith('/api/'), (route) => this.handleApi(route));
        // The gateway's proxies and the services' media files are part of what a page asks for.
        await context.route((requestUrl) => LOCAL_HOSTS.includes(requestUrl.hostname) && /^\/(services|media)\//.test(requestUrl.pathname), (route) => this.handleUrl(route, true));
        for (const handler of this.handlers) {
            if (handler.service === 'url') await context.route(handler.pattern, (route) => this.handleUrl(route, false));
        }
    }

    private routeUrl(pattern: RegExp): void {
        // Handlers added before install() are routed there.
        // Not awaited, so handlers can be chained; the browser gets it before the next navigation.
        if (this.context) this.context.route(pattern, (route) => this.handleUrl(route, false)).catch(() => undefined);
    }

    private find(method: Method, service: string, path: string): { handler: Handler; params: Record<string, string> } | undefined {
        for (const fallback of [false, true]) {
            for (let i = this.handlers.length - 1; i >= 0; i--) {
                const candidate = this.handlers[i];
                if (candidate.fallback === fallback && (candidate.method === '*' || candidate.method === method) && (candidate.service === service || (candidate.service === '*' && service !== 'url'))) {
                    const found = path.match(candidate.pattern);
                    if (found) {
                        candidate.matched += 1;
                        const params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(found[index + 1])]));
                        return { handler: candidate, params };
                    }
                }
            }
        }
        return undefined;
    }

    private async handleApi(route: Route): Promise<void> {
        const request = route.request();
        const url = new URL(request.url());
        const match = url.pathname.match(/^\/api\/([a-z-]+)(\/.*)?$/);
        if (!match) {
            await route.fallback();
            return;
        }

        const [, service, rawPath = '/'] = match;
        const path = rawPath.length > 1 ? rawPath.replace(/\/$/, '') : rawPath;
        await this.answer(route, describeRequest(request, service, path, url), `${request.method()} ${url.pathname}`, true);
    }

    private async handleUrl(route: Route, strict: boolean): Promise<void> {
        const request = route.request();
        const url = new URL(request.url());
        // Without the hash, with the query: what the server would see.
        const full = `${url.origin}${url.pathname}${url.search}`;
        await this.answer(route, describeRequest(request, 'url', full, url), `${request.method()} ${full}`, strict);
    }

    private async answer(route: Route, base: Omit<MockRequest, 'params'>, label: string, strict: boolean): Promise<void> {
        const found = this.find(base.method, base.service, base.path);
        if (!found) {
            if (!strict) {
                await route.fallback();
                return;
            }
            this.calls.push({ ...base, params: {}, status: 501, handled: false });
            await route.fulfill({ status: 501, json: { success: false, message: `Not mocked: ${label}` } });
            return;
        }

        const { handler, params } = found;
        const response = typeof handler.respond === 'function' ? await handler.respond({ ...base, params }) : handler.respond;
        const status = response.abort ? 0 : response.status ?? 200;
        this.calls.push({ ...base, params, status, handled: true });
        if (response.delayMs) await new Promise((resolve) => { setTimeout(resolve, response.delayMs); });
        if (response.abort) {
            await route.abort(response.abort);
            return;
        }

        if (response.body !== undefined) {
            await route.fulfill({ status, body: response.body, contentType: response.contentType ?? 'application/octet-stream', headers: response.headers });
            return;
        }
        await route.fulfill({ status, json: response.json ?? { success: status < 400 }, headers: response.headers });
    }
}
