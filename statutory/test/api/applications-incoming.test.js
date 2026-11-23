const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const { Application } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;

// "incoming" says that the applicant filled in the form of the local organisers.
describe('Applications incoming', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const setIncoming = (applicationId, body) => request({
        path: '/events/' + event.id + '/applications/' + applicationId + '/incoming',
        method: 'PUT',
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const expectForbidden = (res) => {
        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    };

    const expectStored = async (application, incoming) => {
        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.incoming).toEqual(incoming);
    };

    test('should set it for somebody else\'s application when the permissions are okay', async () => {
        const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

        const res = await setIncoming(application.id, { incoming: true });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.incoming).toEqual(true);
        await expectStored(application, true);
    });

    test('should unset it', async () => {
        const application = await generator.createApplication({ user_id: 2, status: 'accepted', incoming: true }, event);

        const res = await setIncoming(application.id, { incoming: false });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.incoming).toEqual(false);
        await expectStored(application, false);
    });

    test('should find the application by its statutory ID', async () => {
        const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

        const res = await setIncoming(application.statutory_id, { incoming: true });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(application.id);
        await expectStored(application, true);
    });

    test('should change nothing when the request has no "incoming"', async () => {
        const application = await generator.createApplication({ user_id: 2, status: 'accepted', incoming: true }, event);

        const res = await setIncoming(application.id, {});

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.incoming).toEqual(true);
        await expectStored(application, true);
    });

    describe('who may set it', () => {
        test.each([
            ['global:manage_incoming:agora', 200],
            ['global:manage_applications:agora', 200],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:manage_incoming:epm', 403],
            ['global:manage_applications:epm', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);
            await expectStored(application, status === 200);
        });

        test('should answer the local organisers with the fields of their own list', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_incoming:agora'] } });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data).sort()).toEqual([...constants.ALLOWED_INCOMING_FIELDS, 'notification_email'].sort());
        });

        test('should return 403 for a member without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expectForbidden(res);
            await expectStored(application, false);
        });

        test('should return 403 for the applicant', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expectForbidden(res);
            await expectStored(application, false);
        });

        // "me" is only for cancelling: not even those who manage applications set the flag through it.
        test('should return 403 through "me", also with every permission', async () => {
            const application = await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);

            const res = await setIncoming('me', { incoming: true });

            expectForbidden(res);
            expect(res.body.message).toEqual('You cannot change the "incoming" attribute through this endpoint.');
            await expectStored(application, false);
        });

        // The local organisers only reach the applications of their own list.
        test.each([
            ['pending', { status: 'pending' }],
            ['rejected', { status: 'rejected' }],
            ['on the waiting list', { status: 'waiting_list' }],
            ['accepted but cancelled', { status: 'accepted', cancelled: true }]
        ])('should return 404 to the local organisers for an application that is %s', async (description, fields) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_incoming:agora'] } });
            const application = await generator.createApplication({ user_id: 2, ...fields }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
            await expectStored(application, false);
        });
    });

    test('should return 404 if the application is not found', async () => {
        const res = await setIncoming(2147483647, { incoming: true });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 for an application to another event', async () => {
        const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, otherEvent);

        const res = await setIncoming(application.id, { incoming: true });

        expect(res.statusCode).toEqual(404);
        await expectStored(application, false);
    });

    describe('validation', () => {
        test.each([
            ['a word', 'yes'],
            ['a number other than 0 and 1', 2],
            ['null', null],
            ['a list', [true]],
            ['an object', { value: true }]
        ])('should return 422 if "incoming" is %s', async (description, value) => {
            const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

            const res = await setIncoming(application.id, { incoming: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('incoming');
            await expectStored(application, false);
        });

        test('should return 422 when setting it on a cancelled application', async () => {
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', cancelled: true }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors.incoming).toEqual(['This application is cancelled, you cannot mark it as incoming.']);
            await expectStored(application, false);
        });

        test('should unset it on a cancelled application', async () => {
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', incoming: true }, event);
            await application.update({ cancelled: true }, { hooks: false, validate: false });

            const res = await setIncoming(application.id, { incoming: false });

            expect(res.statusCode).toEqual(200);
            await expectStored(application, false);
        });

        test('should return 422 when unsetting it on an application that is marked as attended', async () => {
            const application = await generator.createApplication({
                user_id: 2,
                status: 'accepted',
                confirmed: true,
                incoming: true,
                attended: true
            }, event);

            const res = await setIncoming(application.id, { incoming: false });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors.incoming).toEqual(['This application is marked as attended, you cannot mark it as not incoming.']);
            await expectStored(application, true);
        });

        test('should set it on an application that is not confirmed yet', async () => {
            const application = await generator.createApplication({ user_id: 2, status: 'accepted', confirmed: false }, event);

            const res = await setIncoming(application.id, { incoming: true });

            expect(res.statusCode).toEqual(200);
            await expectStored(application, true);
        });
    });
});
