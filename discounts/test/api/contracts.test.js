const nock = require('nock');

const config = require('../../config');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');
const helpers = require('../../lib/helpers');
const fixtures = require('../assets');

describe('Adapter and permission contracts', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    test('should decode discounts manager permission', () => {
        const permissions = helpers.getPermissions(null, fixtures.loadJson('core-permissions-discounts-manager.json').data);

        expect(permissions.manage_discounts).toEqual(true);
    });

    test('should not grant discounts permission for unrelated permissions', () => {
        const permissions = helpers.getPermissions(null, fixtures.loadJson('core-permissions-unrelated-only.json').data);

        expect(permissions.manage_discounts).toEqual(false);
    });

    test('should fetch my profile with auth and service headers', async () => {
        const scope = nock(`${config.core.url}:${config.core.port}`)
            .matchHeader('x-auth-token', 'test-token')
            .matchHeader('x-service', 'discounts')
            .matchHeader('x-requested-with', 'XMLHttpRequest')
            .get('/members/me')
            .reply(200, fixtures.loadJson('core-profile-success.json'));

        const response = await core.getMyProfile({
            headers: {
                'x-auth-token': 'test-token'
            }
        });

        expect(response).toEqual(fixtures.loadJson('core-profile-success.json'));
        expect(scope.isDone()).toEqual(true);
    });

    test('should fetch my permissions with auth and service headers', async () => {
        const scope = nock(`${config.core.url}:${config.core.port}`)
            .matchHeader('x-auth-token', 'test-token')
            .matchHeader('x-service', 'discounts')
            .matchHeader('x-requested-with', 'XMLHttpRequest')
            .get('/my_permissions')
            .reply(200, fixtures.loadJson('core-permissions-unrelated-only.json'));

        const response = await core.getMyPermissions({
            headers: {
                'x-auth-token': 'test-token'
            }
        });

        expect(response).toEqual(fixtures.loadJson('core-permissions-unrelated-only.json'));
        expect(scope.isDone()).toEqual(true);
    });

    test('should send mail with expected payload', async () => {
        const payload = {
            from: 'discounts@myaegee.test',
            to: 'member@myaegee.test',
            subject: 'Your test discount code',
            template: 'custom.html',
            parameters: {
                body: 'discount body'
            }
        };

        const scope = nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/', payload)
            .reply(200, fixtures.loadJson('mailer-success.json'));

        const response = await mailer.sendMail(payload);

        expect(response).toEqual(fixtures.loadJson('mailer-success.json'));
        expect(scope.isDone()).toEqual(true);
    });

    test('should throw on malformed mailer response', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .reply(500, 'Some error happened.');

        await expect(mailer.sendMail({
            to: 'member@myaegee.test',
            subject: 'Your test discount code',
            template: 'custom.html',
            parameters: {
                body: 'discount body'
            }
        })).rejects.toThrow('Malformed response from mailer: Some error happened.');
    });

    test('should throw on unsuccessful mailer response', async () => {
        nock(`${config.mailer.url}:${config.mailer.port}`)
            .post('/')
            .reply(500, fixtures.loadJson('mailer-unsuccessful.json'));

        await expect(mailer.sendMail({
            to: 'member@myaegee.test',
            subject: 'Your test discount code',
            template: 'custom.html',
            parameters: {
                body: 'discount body'
            }
        })).rejects.toThrow('Unsuccessful response from mailer: {"success":false,"message":"Some error"}');
    });
});
