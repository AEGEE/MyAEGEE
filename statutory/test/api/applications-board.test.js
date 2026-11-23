const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

describe('Applications pax type/board comment', () => {
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

        // Checking on agora and on delegate, for others - pretty much the same.
        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'year').toDate(),
            application_period_ends: moment().toDate(),
            board_approve_deadline: moment().add(1, 'year').toDate(),
        });

        application = await generator.createApplication({
            user_id: regularUser.id,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);
    });

    afterEach(async () => {
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should not succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/applications/me/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when the permissions are okay', async () => {
        application = await application.update({ user_id: 1337 }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', board_comment: 'test', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual('delegate');
        expect(res.body.data.participant_order).toEqual(1);
        expect(res.body.data.board_comment).toEqual('test');
    });

    test('should succeed when addressed by statutory ID', async () => {
        application = await application.update({ user_id: 1337 }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.statutory_id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', board_comment: 'test', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual('delegate');
        expect(res.body.data.participant_order).toEqual(1);
        expect(res.body.data.board_comment).toEqual('test');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        application = await application.update({ user_id: 1337 }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed for board comment when user has approve_members but not manage_memberslist', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });

        application = await application.update({ user_id: 1337 }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', board_comment: 'test', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.participant_type).toEqual('delegate');
    });

    test('should return 403 for board comment when user has manage_memberslist but not approve_members', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        application = await application.update({ user_id: 1337 }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if the application is not found', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/1337/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if info is invalid', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'invalid', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant type is set, but participant order is not', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_order: 1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is not a number', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 'invalid' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is negative', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: -1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if participant order is set, but participant type is not', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if there is already an application with the same pax type and order from this body', async () => {
        application = await application.update({
            user_id: 1,
            participant_type: 'delegate',
            participant_order: 1
        }, { returning: ['*'] });

        const otherApplication = await generator.createApplication({
            user_id: 2,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + otherApplication.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed and update nothing when the body is empty', async () => {
        application = await application.update({
            participant_type: 'delegate',
            participant_order: 1
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual(application.participant_type);
        expect(res.body.data.board_comment).toEqual(application.board_comment);
    });

    test('should return 403 if the user is not within deadline and doesn\'t have global permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        event = await event.update({
            type: 'agora',
            application_period_starts: moment().subtract(5, 'year').toDate(),
            application_period_ends: moment().subtract(4, 'year').toDate(),
            board_approve_deadline: moment().subtract(3, 'year').toDate(),
            starts: moment().subtract(2, 'year').toDate(),
            ends: moment().subtract(1, 'year').toDate(),
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when unsetting the pax type/order', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should succeed if the limit is unlimited', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        await generator.createPaxLimit({
            body_id: regularUser.bodies[0].id,
            event_type: event.type,
            delegate: null
        });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should return 403 when using default limits and too much applications', async () => {
        // The body type is antenna, it cannot send observers.
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'observer', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 when using custom limits and too much applications', async () => {
        await generator.createPaxLimit({
            body_id: regularUser.bodies[0].id,
            event_type: event.type,
            delegate: 0
        });

        // The body type is antenna, it cannot send observers.
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 when the pax order is too big', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1337 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an error if body query returns net error', async () => {
        mock.mockAll({ body: { netError: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns bad response', async () => {
        mock.mockAll({ body: { badResponse: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        application = await application.update({
            participant_order: 1,
            participant_type: 'delegate'
        }, { returning: ['*'] });

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: null, participant_order: null }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should say which participant orders the limit of the body allows', async () => {
        // An antenna sends at most 3 delegates.
        const agora = await generator.createEvent({ type: 'agora', applications: [] });
        const other = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, agora);

        const res = await request({
            path: '/events/' + agora.id + '/applications/' + other.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 4 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Expected a participant order from 1 to 3, got 4.' });

        const applicationFromDb = await Application.findByPk(other.id);
        expect(applicationFromDb.participant_order).toEqual(null);
    });

    // The board of a body sets the participant types from the start of the application period
    // until the board approve deadline, both ends included.
    describe('the board approve deadline', () => {
        const setBoard = () => request({
            path: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', participant_order: 1 }
        });

        beforeEach(async () => {
            application = await application.update({ user_id: 1337 }, { returning: ['*'] });
        });

        test.each([
            ['refuses a board member 1 ms before the application period starts', 'application_period_starts', -1, 403],
            ['lets a board member set the type exactly when the application period starts (inclusive)', 'application_period_starts', 0, 200],
            ['lets a board member set the type exactly at the board approve deadline (inclusive)', 'board_approve_deadline', 0, 200],
            ['refuses a board member 1 ms after the board approve deadline', 'board_approve_deadline', 1, 403]
        ])('%s', async (name, field, offset, status) => {
            // The core mock makes the user a board member of the applicant's body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await setBoard();

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(status === 200 ? 'delegate' : null);
            expect(applicationFromDb.participant_order).toEqual(status === 200 ? 1 : null);
        });

        test.each([
            ['1 ms before the application period starts', 'application_period_starts', -1],
            ['1 ms after the board approve deadline', 'board_approve_deadline', 1]
        ])('lets those who approve the members of all bodies set the type %s', async (name, field, offset) => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:approve_members:agora'] },
                approvePermissions: { noPermissions: true }
            });
            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await setBoard();

            expect(res.statusCode).toEqual(200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual('delegate');
        });
    });

    describe('who may set it without being in the board of the body', () => {
        // Managing the applications does not include choosing the participant types.
        test.each([
            ['global:approve_members:agora', 200],
            ['global:approve_members:epm', 403],
            ['global:manage_applications:agora', 403],
            ['global:manage_incoming:agora', 403],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({
                mainPermissions: { permissions: [permission] },
                approvePermissions: { noPermissions: true }
            });
            // Accepted, so that the local organisers reach the application too.
            application = await application.update({ user_id: 1337, status: 'accepted' }, { returning: ['*'] });

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/board',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { participant_type: 'delegate', participant_order: 1, board_comment: 'Changed' }
            });

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            // Nothing is stored when the request is refused.
            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(status === 200 ? 'delegate' : null);
            expect(applicationFromDb.board_comment).toEqual(status === 200 ? 'Changed' : application.board_comment);
        });

        test('should return 403 for a board member of another body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            application = await application.update({ user_id: 1337, body_id: 1337 }, { returning: ['*'] });

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/board',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { participant_type: 'visitor', participant_order: 1 }
            });

            expect(res.statusCode).toEqual(403);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(null);
        });
    });
});
