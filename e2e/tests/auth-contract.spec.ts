// The mocked-API suite answers the pages of the area `auth` with the builders of
// ui/support/factories/auth.ts. This checks them against what core really answers (see
// core-contract.spec.ts for how the comparison works).
import { test, expect, expectStatus } from '../support/api.ts';
import { PASSWORD } from '../support/constants.ts';
import { expectShape } from '../support/contract.ts';
import { tokens } from '../ui/support/factories/auth.ts';

test.describe('auth factories match the real API', () => {
    test('the tokens of a login and of a renewal', async ({ api }) => {
        const login = await api.request.post('/api/core/login', { data: { username: 'member', password: PASSWORD } });
        expectStatus({ status: login.status(), body: await login.text() }, 200);
        const loggedIn = await login.json() as { refresh_token: string };
        expectShape('tokens', tokens(), loggedIn);

        const renewal = await api.call<{ refresh_token: string }>(null, 'POST', '/api/core/renew', { refresh_token: loggedIn.refresh_token });
        expectStatus(renewal, 200);
        expectShape('tokens', tokens(), renewal.body);
        // core rotates the refresh token.
        expect(renewal.body.refresh_token).not.toBe(loggedIn.refresh_token);

        await api.call(null, 'POST', '/api/core/logout', { refresh_token: renewal.body.refresh_token });
    });
});
