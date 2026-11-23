const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Event, Application, PaxLimit } = require('../../models');

// The permissions for events and applications are global ones: a check names the full
// global permission and compares it exactly.
describe('Permission scope', () => {
    let event;
    let application;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        // Outside of the application period.
        event = await generator.createEvent({ type: 'agora', applications: [] });
        application = await generator.createApplication({
            user_id: 1337,
            status: 'accepted',
            confirmed: true,
            registered: true
        }, event);
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const expectForbidden = (res) => {
        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    };

    describe.each(['local', 'global:co'])('with a "%s" variant of the permission', (prefix) => {
        // 'local:manage_event:agora' and 'global:co_manage_event:agora'
        const permission = (name) => (prefix === 'local' ? `local:${name}` : `global:co_${name}`);

        test('should not create an event', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('manage_event:agora')] } });

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'agora' })
            });

            expectForbidden(res);
            expect(await Event.count()).toEqual(1);
        });

        test('should not set a participants limit', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('manage_event:agora')] } });

            const res = await request({
                path: '/limits/agora',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generatePaxLimit({ event_type: 'agora' })
            });

            expectForbidden(res);
            expect(await PaxLimit.count()).toEqual(0);
        });

        test('should not delete a participants limit', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('manage_event:agora')] } });
            const limit = await generator.createPaxLimit({ event_type: 'agora' });

            const res = await request({
                path: '/limits/agora/' + limit.body_id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectForbidden(res);
            expect(await PaxLimit.count()).toEqual(1);
        });

        test.each([
            ['status', 'manage_applications:agora', { status: 'rejected' }],
            ['confirmed', 'manage_applications:agora', { confirmed: false }],
            ['confirmed', 'manage_incoming:agora', { confirmed: false }],
            ['incoming', 'manage_incoming:agora', { incoming: true }],
            ['attended', 'manage_incoming:agora', { attended: true }],
            ['registered', 'manage_juridical:agora', { registered: false }],
            ['departed', 'manage_juridical:agora', { departed: true }],
            ['is_on_memberslist', 'update_memberslist_status:agora', { is_on_memberslist: true }],
            ['cancel', 'manage_applications:agora', { cancelled: true }]
        ])('should not set "%s" of an application with %s', async (route, name, body) => {
            mock.mockAll({ mainPermissions: { permissions: [permission(name)] } });

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/' + route,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body
            });

            expectForbidden(res);

            const applicationFromDb = await Application.findByPk(application.id);
            for (const [key, value] of Object.entries(body)) {
                expect(applicationFromDb[key]).not.toEqual(value);
            }
        });

        test('should not edit somebody else\'s application', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('manage_applications:agora')] } });

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { allergies: 'Changed' }
            });

            expectForbidden(res);
        });

        test('should not edit the own application outside of the application period', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('apply:agora')] } });
            const ownApplication = await generator.createApplication({
                user_id: regularUser.id,
                body_id: regularUser.bodies[0].id
            }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + ownApplication.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { allergies: 'Changed' }
            });

            expectForbidden(res);
        });

        test('should not reveal the status of the own application before it is published', async () => {
            mock.mockAll({ mainPermissions: { permissions: [permission('manage_applications:agora')] } });
            await event.update({ participants_list_publish_deadline: moment().add(1, 'week').toDate() }, { validate: false });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);

            const res = await request({
                path: '/mine',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].applications[0].status).toEqual('pending');
        });
    });
});
