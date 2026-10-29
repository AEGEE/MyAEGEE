jest.mock('request-promise-native', () => jest.fn());

const request = require('request-promise-native');
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
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://core:8084/members/me',
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': 'typed-token',
                'X-Service': 'discounts'
            },
            simple: false,
            json: true
        }));
    });

    test('getMyPermissions should call oms-core with expected headers', async () => {
        request.mockResolvedValue(fullPermissionsBody);

        const body = await core.getMyPermissions({
            headers: { 'x-auth-token': 'typed-token' }
        });

        expect(body).toEqual(fullPermissionsBody);
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            url: 'http://core:8084/my_permissions',
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-Auth-Token': 'typed-token',
                'X-Service': 'discounts'
            },
            simple: false,
            json: true
        }));
    });
});
