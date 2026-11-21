jest.mock('../../lib/http', () => ({ request: jest.fn() }));

const { request } = require('../../lib/http');
const config = require('../../config');
const core = require('../../lib/core');
const fullPermissionsBody = require('../assets/oms-core-permissions-full.json');
const validUserBody = require('../assets/oms-core-valid.json');

describe('Core client', () => {
    beforeEach(() => {
        request.mockReset();
    });

    test('getMyProfile should call oms-core with expected headers', async () => {
        request.mockResolvedValue(validUserBody);

        const body = await core.getMyProfile({
            headers: { 'x-auth-token': 'typed-token' }
        });

        expect(body).toEqual(validUserBody);
        expect(request).toHaveBeenCalledWith({
            url: `${config.core.url}:${config.core.port}/members/me`,
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': 'typed-token',
                'X-Service': 'discounts'
            }
        });
    });

    test('getMyPermissions should call oms-core with expected headers', async () => {
        request.mockResolvedValue(fullPermissionsBody);

        const body = await core.getMyPermissions({
            headers: { 'x-auth-token': 'typed-token' }
        });

        expect(body).toEqual(fullPermissionsBody);
        expect(request).toHaveBeenCalledWith({
            url: `${config.core.url}:${config.core.port}/my_permissions`,
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': 'typed-token',
                'X-Service': 'discounts'
            }
        });
    });
});
