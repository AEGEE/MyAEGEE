import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError } from './api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api', () => {
    const assign = vi.fn();

    beforeEach(() => {
        localStorage.setItem('access-token', 'old-access');
        localStorage.setItem('refresh-token', 'refresh');
        vi.stubGlobal('location', { ...window.location, assign, pathname: '/events', search: '' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        localStorage.clear();
        assign.mockReset();
    });

    it('sends the access token', async () => {
        const fetch = vi.fn().mockResolvedValue(json(200, { success: true, data: [] }));
        vi.stubGlobal('fetch', fetch);

        await api.get('/api/events', { query: { limit: 30, type: ['training', 'nwm'] } });

        expect(fetch.mock.calls[0][0]).toBe('/api/events?limit=30&type%5B%5D=training&type%5B%5D=nwm');
        expect(fetch.mock.calls[0][1].headers['X-Auth-Token']).toBe('old-access');
    });

    it('renews an expired access token once for parallel requests and retries them', async () => {
        const fetch = vi.fn(async (url: string, init: RequestInit) => {
            if (url === '/api/core/renew') return json(200, { success: true, access_token: 'new-access' });
            const token = (init.headers as Record<string, string>)['X-Auth-Token'];
            return token === 'new-access' ? json(200, { success: true, data: url }) : json(401, { success: false, message: 'expired' });
        });
        vi.stubGlobal('fetch', fetch);

        const results = await Promise.all([api.get<string>('/api/events/a'), api.get<string>('/api/events/b')]);

        expect(results.map((result) => result.data)).toEqual(['/api/events/a', '/api/events/b']);
        expect(fetch.mock.calls.filter(([url]) => url === '/api/core/renew')).toHaveLength(1);
        expect(localStorage.getItem('access-token')).toBe('new-access');
        expect(localStorage.getItem('refresh-token')).toBe('refresh');
    });

    it('logs out and goes to the login page when the session cannot be renewed', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/core/renew'
            ? json(403, { success: false, message: 'Token is not found.' })
            : json(401, { success: false, message: 'expired' }))));

        await expect(api.get('/api/events/mine/participating')).rejects.toBeInstanceOf(ApiError);

        expect(localStorage.getItem('access-token')).toBeNull();
        expect(assign).toHaveBeenCalledWith('/login?to=%2Fevents');
    });

    it('only reports a failed session check, without going to the login page', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/core/renew'
            ? json(403, { success: false })
            : json(401, { success: false }))));

        await expect(api.get('/api/core/members/me', { forAuth: true })).rejects.toBeInstanceOf(ApiError);
        expect(assign).not.toHaveBeenCalled();
    });
});
