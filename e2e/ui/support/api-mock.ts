// Answers the frontend's /api calls inside the browser (page.route), so the mocked-API suite
// needs no backend. Tests register handlers with `on()`; the last matching handler wins, so a
// test can override the defaults. Every request is recorded for assertions.
//
// Paths are written like express routes without the /api prefix: 'GET events /single/:id'.
// Requests outside /api (calendar and Jira proxies, media files, other hosts) are answered
// with `url()`. How to use all of it: docs/testing/writing-ui-specs.md.
import type { Page, Request, Route } from '@playwright/test';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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

interface Handler {
    method: Method | '*';
    service: string;
    pattern: RegExp;
    keys: string[];
    respond: Responder;
    fallback: boolean;
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

const splitRoute = (route: string): [string, string, string] => {
    const [method, service, ...rest] = route.trim().split(/\s+/);
    return [method, service, rest.join(' ') || '/'];
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

    private page: Page | undefined;

    // 'GET events /single/:id' or 'GET events *'. A responder can be a fixed response or a function.
    on(route: string, respond: Responder): this {
        const [method, service, path] = splitRoute(route);
        this.handlers.push({ method: method as Method | '*', service, ...compile(path), respond, fallback: this.registeringFallbacks });
        return this;
    }

    // Shorthand for a 200 with this JSON body.
    json(route: string, json: unknown): this {
        return this.on(route, { json });
    }

    // Answers requests outside /api: a path glob for this origin ('/services/calendar-cors/**',
    // '/media/**') or a full URL glob for another host ('https://api.github.com/**'). Recorded
    // with service 'url' and the full URL as path: `api.callsTo('GET url /services/calendar-cors/**')`.
    url(method: Method | '*', glob: string, respond: Responder): this {
        this.handlers.push({ method, service: 'url', pattern: compileGlob(glob), keys: [], respond, fallback: this.registeringFallbacks });
        // Routes of the page win over the context's block on other hosts (ui/support/test.ts).
        this.routeUrl(compileGlob(glob));
        return this;
    }

    // Handlers registered inside `register` only answer what no other handler matches, in
    // whatever order they are added. For a spec that ends on another area's page: that page gets
    // generic answers (`api.fallback(mockEverything)`) while the page under test stays strict.
    fallback(register: (api: ApiMock) => void): this {
        this.registeringFallbacks = true;
        try {
            register(this);
        } finally {
            this.registeringFallbacks = false;
        }
        return this;
    }

    // Calls that matched no handler: the test forgot to mock them.
    get unhandled(): RecordedCall[] {
        return this.calls.filter((call) => !call.handled);
    }

    // Recorded calls matching 'METHOD service /path/:param', or 'METHOD url <glob>'.
    callsTo(route: string): RecordedCall[] {
        const [method, service, path] = splitRoute(route);
        const pattern = service === 'url' ? compileGlob(path) : compile(path).pattern;
        return this.calls.filter((call) => (method === '*' || call.method === method) && call.service === service && pattern.test(call.path));
    }

    async install(page: Page): Promise<void> {
        this.page = page;
        await page.route(/\/api\//, (route) => this.handleApi(route));
        // The gateway's proxies and the services' media files are part of what a page asks for.
        await page.route((url) => /^\/(services|media)\//.test(url.pathname), (route) => this.handleUrl(route, true));
        for (const handler of this.handlers) {
            if (handler.service === 'url') this.routeUrl(handler.pattern);
        }
    }

    private routeUrl(pattern: RegExp): void {
        // Handlers added before install() are routed there.
        // Not awaited, so handlers can be chained; the browser gets it before the next navigation.
        if (this.page) this.page.route(pattern, (route) => this.handleUrl(route, false)).catch(() => undefined);
    }

    private find(method: Method, service: string, path: string): { handler: Handler; params: Record<string, string> } | undefined {
        for (const fallback of [false, true]) {
            for (let i = this.handlers.length - 1; i >= 0; i--) {
                const candidate = this.handlers[i];
                if (candidate.fallback === fallback && (candidate.method === '*' || candidate.method === method) && (candidate.service === service || (candidate.service === '*' && service !== 'url'))) {
                    const found = path.match(candidate.pattern);
                    if (found) {
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
