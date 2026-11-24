const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

const NOT_FOUND = 'Event with such url or ID is not found.';

// A draft event exists only for those who manage events of its type
// (the holders of global:manage_event:<type>), and nobody can apply to it.
describe('Draft events', () => {
    let draft;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        // In its application period, so that only the status stands in the way of applying.
        draft = await generator.createEvent({
            type: 'agora',
            status: 'draft',
            url: 'draft-agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const expectEventNotFound = (res) => {
        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(NOT_FOUND);
        expect(res.body).not.toHaveProperty('data');
    };

    describe('displaying', () => {
        test('should not display a draft without a session', async () => {
            mock.mockAll({
                core: { unauthorized: true },
                mainPermissions: { unauthorized: true },
                approvePermissions: { unauthorized: true },
                memberslistPermissions: { unauthorized: true }
            });

            const res = await request({ path: '/events/' + draft.id, method: 'GET' });

            expectEventNotFound(res);
        });

        test('should not display a draft to a member without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectEventNotFound(res);
        });

        test('should not display a draft by its url to a member without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await request({
                path: '/events/draft-agora',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectEventNotFound(res);
        });

        test('should not display a draft to those who manage events of another type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:epm', 'global:manage_event:spm'] } });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectEventNotFound(res);
        });

        test('should not display a draft to those who manage only its applications', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_applications:agora',
                        'global:manage_incoming:agora',
                        'global:manage_juridical:agora',
                        'global:approve_members:agora',
                        'global:apply:agora'
                    ]
                }
            });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expectEventNotFound(res);
        });

        test('should display a draft to those who manage events of its type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:agora'] } });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.id).toEqual(draft.id);
            expect(res.body.data.status).toEqual('draft');
        });

        test('should display a draft by its url to those who manage events of its type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:agora'] } });

            const res = await request({
                path: '/events/draft-agora',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(draft.id);
        });

        test('should display the event to everyone once it is published', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await draft.update({ status: 'published' });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(draft.id);
        });
    });

    describe('everything under the event', () => {
        // One route of every router that is mounted under an event. The caller holds every
        // permission for the event type except the one to manage the events themselves.
        const everythingButManageEvent = [
            'global:manage_applications:agora',
            'global:manage_incoming:agora',
            'global:manage_juridical:agora',
            'global:approve_members:agora',
            'global:manage_memberslist:agora',
            'global:see_memberslists:agora',
            'global:use_massmailer:agora',
            'global:manage_candidates:agora',
            'global:manage_plenaries:agora',
            'global:see_plenaries:agora',
            'global:manage_question_lines:agora'
        ];

        const routes = [
            { method: 'GET', suffix: '/fields/applications/all' },
            { method: 'PUT', suffix: '', body: { name: 'Changed' } },
            { method: 'PUT', suffix: '/status', body: { status: 'published' } },
            { method: 'GET', suffix: '/applications/all' },
            { method: 'GET', suffix: '/applications/stats' },
            { method: 'GET', suffix: '/applications/me' },
            { method: 'GET', suffix: '/memberslists' },
            { method: 'POST', suffix: '/massmailer', body: { subject: 'Subject', text: 'Text' } },
            { method: 'GET', suffix: '/votes-amounts/antenna' },
            { method: 'GET', suffix: '/positions' },
            { method: 'GET', suffix: '/positions/1/candidates/1' },
            { method: 'GET', suffix: '/question-lines' },
            { method: 'GET', suffix: '/question-lines/1/questions/1' },
            { method: 'GET', suffix: '/plenaries' }
        ];

        test.each(routes)('should answer 404 on $method /events/:event_id$suffix', async ({ method, suffix, body }) => {
            mock.mockAll({ mainPermissions: { permissions: everythingButManageEvent } });
            await generator.createApplication({ user_id: regularUser.id }, draft);

            const res = await request({
                path: '/events/' + draft.id + suffix,
                method,
                headers: { 'X-Auth-Token': 'blablabla' },
                body
            });

            expectEventNotFound(res);
        });
    });

    describe('listing', () => {
        test('should not list a draft, also not for those who manage events of its type', async () => {
            const published = await generator.createEvent({ type: 'agora', status: 'published', applications: [] });

            const res = await request({
                path: '/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((event) => event.id)).toEqual([published.id]);
        });

        test('should not list a draft among the events a member applied to', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const published = await generator.createEvent({ type: 'agora', status: 'published', applications: [] });
            await generator.createApplication({ user_id: regularUser.id }, draft);
            await generator.createApplication({ user_id: regularUser.id }, published);

            const res = await request({
                path: '/mine',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((event) => event.id)).toEqual([published.id]);
        });

        test('should list a draft among the events its manager applied to', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:agora'] } });

            const epmDraft = await generator.createEvent({ type: 'epm', status: 'draft', applications: [] });
            await generator.createApplication({ user_id: regularUser.id }, draft);
            await generator.createApplication({ user_id: regularUser.id }, epmDraft);

            const res = await request({
                path: '/mine',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((event) => event.id)).toEqual([draft.id]);
        });
    });

    describe('applying', () => {
        const application = () => generator.generateApplication({
            body_id: regularUser.bodies[0].id
        }, draft);

        test('should not let a member apply to a draft', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await request({
                path: '/events/' + draft.id + '/applications',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application()
            });

            expectEventNotFound(res);
            expect(await Application.count()).toEqual(0);
        });

        test('should not let those who manage the event apply to a draft', async () => {
            // Also not with the permissions that normally allow applying outside of the application period.
            mock.mockAll({
                mainPermissions: {
                    permissions: ['global:manage_event:agora', 'global:manage_applications:agora', 'global:apply:agora']
                }
            });

            const res = await request({
                path: '/events/' + draft.id + '/applications',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application()
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('You cannot apply to this event, as it is not published yet.');
            expect(await Application.count()).toEqual(0);
        });

        test('should tell those who manage the event that nobody can apply to a draft', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: ['global:manage_event:agora', 'global:manage_applications:agora', 'global:apply:agora']
                }
            });

            const res = await request({
                path: '/events/' + draft.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.permissions.apply).toEqual(false);
        });

        test('should let a member apply once the event is published', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await draft.update({ status: 'published' });

            const res = await request({
                path: '/events/' + draft.id + '/applications',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: application()
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(await Application.count()).toEqual(1);
        });
    });
});
