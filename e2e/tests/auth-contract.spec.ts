// The mocked-API suite answers the pages of the area `auth` with the builders of
// ui/support/factories/auth.ts. This checks them against what core really answers (see
// core-contract.spec.ts for how the comparison works).
import { test, expect, expectStatus } from '../support/api.ts';
import { PASSWORD } from '../support/constants.ts';
import { expectShape } from '../support/contract.ts';
import { createCampaign } from '../support/core-data.ts';
import { signedUpMember, tokens } from '../ui/support/factories/auth.ts';

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

    test('the account that signing up makes', async ({ api }) => {
        const [campaign, remove] = await createCampaign(api);
        try {
            const suffix = Date.now();
            const filled = signedUpMember();
            const answer = await api.call<{ data: unknown }>(null, 'POST', `/api/core/signup/${campaign.url}`, {
                username: `e2e-signup-${suffix}`,
                email: `e2e-signup-${suffix}@example.com`,
                password: '5ecr3t5ecr3t',
                first_name: filled.first_name,
                last_name: filled.last_name,
                date_of_birth: filled.date_of_birth,
                gender: filled.gender,
                phone: filled.phone,
                address: filled.address,
                about_me: filled.about_me,
                privacy_consent: filled.privacy_consent
            });
            expectStatus(answer, 200);
            expectShape('signedUpMember', filled, answer.body.data);
        } finally {
            await remove();
        }
    });
});
