// Answers the frontend's /api calls inside the browser (page.route), so the mocked-API suite
// needs no backend. Tests register handlers with `on()`; the last matching handler wins, so a
// test can override the defaults. Every request is recorded for assertions.
//
// Paths are written like express routes without the /api prefix: 'GET events /single/:id'.
import type { Page, Request, Route } from '@playwright/test';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface MockRequest {
    method: Method;
    service: string;
    path: string;
    params: Record<string, string>;
    query: URLSearchParams;
    body: unknown;
    headers: Record<string, string>;
}

export interface MockResponse {
    status?: number;
    json?: unknown;
    // Waits this long before answering, to see loading states.
    delayMs?: number;
}

type Responder = MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>);

interface Handler {
    method: Method | '*';
    service: string;
    pattern: RegExp;
    keys: string[];
    respond: Responder;
}

export interface RecordedCall extends MockRequest {
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

const parseBody = (request: Request): unknown => {
    const raw = request.postData();
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
};

export class ApiMock {
    readonly calls: RecordedCall[] = [];

    private readonly handlers: Handler[] = [];

    // 'GET events /single/:id' or 'GET events *'. A responder can be a fixed response or a function.
    on(route: string, respond: Responder): this {
        const [method, service, path = '/'] = route.split(/\s+/);
        this.handlers.push({ method: method as Method | '*', service, ...compile(path), respond });
        return this;
    }

    // Shorthand for a 200 with this JSON body.
    json(route: string, json: unknown): this {
        return this.on(route, { json });
    }

    // Calls that matched no handler: the test forgot to mock them.
    get unhandled(): RecordedCall[] {
        return this.calls.filter((call) => !call.handled);
    }

    // Recorded calls matching 'METHOD service /path/:param'.
    callsTo(route: string): RecordedCall[] {
        const [method, service, path = '/'] = route.split(/\s+/);
        const { pattern } = compile(path);
        return this.calls.filter((call) => call.method === method && call.service === service && pattern.test(call.path));
    }

    async install(page: Page): Promise<void> {
        await page.route(/\/api\//, (route) => this.handle(route));
    }

    private async handle(route: Route): Promise<void> {
        const request = route.request();
        const url = new URL(request.url());
        const match = url.pathname.match(/^\/api\/([a-z-]+)(\/.*)?$/);
        if (!match) {
            await route.fallback();
            return;
        }

        const [, service, rawPath = '/'] = match;
        const path = rawPath.length > 1 ? rawPath.replace(/\/$/, '') : rawPath;
        const method = request.method() as Method;
        const base = {
            method,
            service,
            path,
            query: url.searchParams,
            body: parseBody(request),
            headers: request.headers()
        };

        let handler: Handler | undefined;
        let params: Record<string, string> = {};
        for (let i = this.handlers.length - 1; i >= 0; i--) {
            const candidate = this.handlers[i];
            if ((candidate.method === '*' || candidate.method === method) && candidate.service === service) {
                const found = path.match(candidate.pattern);
                if (found) {
                    handler = candidate;
                    params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(found[index + 1])]));
                    break;
                }
            }
        }

        if (!handler) {
            this.calls.push({ ...base, params, status: 501, handled: false });
            await route.fulfill({ status: 501, json: { success: false, message: `Not mocked: ${method} ${url.pathname}` } });
            return;
        }

        const response = typeof handler.respond === 'function' ? await handler.respond({ ...base, params }) : handler.respond;
        const status = response.status ?? 200;
        this.calls.push({ ...base, params, status, handled: true });
        if (response.delayMs) await new Promise((resolve) => { setTimeout(resolve, response.delayMs); });
        await route.fulfill({ status, json: response.json ?? { success: status < 400 } });
    }
}
