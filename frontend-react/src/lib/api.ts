// Talks to the MyAEGEE services through the gateway (/api/<service>/...), with the session the
// Vue app keeps in localStorage: `access-token` is sent as X-Auth-Token, and when it has
// expired (401) it's renewed once with `refresh-token` (POST /api/core/renew) and the request
// is retried. Both apps use the same keys, so logging in on one logs in on the other.
import { handOver } from './flash';

export const SERVICES = {
    core: '/api/core',
    events: '/api/events',
    summeruniversity: '/api/summeruniversity',
    statutory: '/api/statutory'
} as const;

export const ACCESS_TOKEN_KEY = 'access-token';
export const REFRESH_TOKEN_KEY = 'refresh-token';

// The services' response envelope.
export interface Envelope<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: Record<string, unknown>;
    errors?: Record<string, string[]>;
}

export class ApiError extends Error {
    readonly status: number;

    readonly body: Partial<Envelope<unknown>> | null;

    constructor(status: number, body: Partial<Envelope<unknown>> | null) {
        super(body?.message ?? `Request failed with status code ${status}`);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

// Query parameters like the Vue app sends them (qs with arrayFormat: 'brackets').
export type Query = Record<string, string | number | boolean | (string | number)[] | null | undefined>;

const toSearch = (query: Query = {}): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value == null) continue;
        if (Array.isArray(value)) value.forEach((item) => params.append(`${key}[]`, String(item)));
        else params.append(key, String(value));
    }
    const search = params.toString();
    return search ? `?${search}` : '';
};

const storage = {
    get: (key: string): string | null => {
        try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set: (key: string, value: string): void => {
        try { window.localStorage.setItem(key, value); } catch { /* unavailable */ }
    },
    remove: (key: string): void => {
        try { window.localStorage.removeItem(key); } catch { /* unavailable */ }
    }
};

export const hasSession = (): boolean => Boolean(storage.get(ACCESS_TOKEN_KEY) || storage.get(REFRESH_TOKEN_KEY));

export const clearSession = (): void => {
    storage.remove(ACCESS_TOKEN_KEY);
    storage.remove(REFRESH_TOKEN_KEY);
};

// The login page is the Vue app's: a full page load, coming back to `returnTo` afterwards.
export const goToLogin = (returnTo = window.location.pathname + window.location.search): void => {
    handOver();
    window.location.assign(`/login?to=${encodeURIComponent(returnTo)}`);
};

let renewal: Promise<string> | null = null;

// One renewal at a time, shared by all requests that got a 401 meanwhile.
const renewAccessToken = (): Promise<string> => {
    renewal ??= (async () => {
        const refreshToken = storage.get(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new ApiError(401, { message: 'No refresh token' });
        // Not through request(): a failing renewal must not try to renew itself.
        const response = await fetch(`${SERVICES.core}/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        const body = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string } | null;
        if (!response.ok || !body?.access_token) throw new ApiError(response.status, body as Partial<Envelope<unknown>>);
        storage.set(ACCESS_TOKEN_KEY, body.access_token);
        if (body.refresh_token) storage.set(REFRESH_TOKEN_KEY, body.refresh_token);
        return body.access_token;
    })().finally(() => { renewal = null; });
    return renewal;
};

export interface RequestOptions {
    query?: Query;
    body?: unknown;
    signal?: AbortSignal;
    // Requests that check the session (GET /members/me): a failed renewal just means
    // "not logged in" instead of sending the user to the login page.
    forAuth?: boolean;
}

export async function request<T>(method: string, url: string, options: RequestOptions = {}): Promise<Envelope<T>> {
    const send = (token: string | null) => fetch(url + toSearch(options.query), {
        method,
        signal: options.signal,
        headers: {
            Accept: 'application/json',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { 'X-Auth-Token': token } : {})
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    let response = await send(storage.get(ACCESS_TOKEN_KEY));

    if (response.status === 401) {
        let token: string;
        try {
            token = await renewAccessToken();
        } catch (error) {
            clearSession();
            if (!options.forAuth) goToLogin();
            throw error instanceof ApiError ? error : new ApiError(401, null);
        }
        response = await send(token);
    }

    const body = await response.json().catch(() => null) as Envelope<T> | null;
    if (!response.ok || !body || body.success === false) throw new ApiError(response.status, body);
    return body;
}

export const api = {
    get: <T>(url: string, options?: RequestOptions) => request<T>('GET', url, options),
    post: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>('POST', url, { ...options, body }),
    put: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', url, { ...options, body }),
    delete: <T>(url: string, options?: RequestOptions) => request<T>('DELETE', url, options)
};

// "<message>: <reason>", the way the Vue app's showError() words it.
export const errorMessage = (message: string, error: unknown): string => {
    if (error instanceof ApiError && error.body?.message) return `${message}: ${error.body.message}`;
    if (error instanceof Error) return `${message}: ${error.message}`;
    return message;
};
