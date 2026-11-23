const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

describe('Applications pax type/board comment for a body', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'year').toDate(),
            application_period_ends: moment().toDate(),
            board_approve_deadline: moment().add(1, 'year').toDate(),
        });
    });

    afterEach(async () => {
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should succeed when the permissions are okay', async () => {
        const applications = [
            await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event),
            await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event),
            await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event)
        ];

        const extraApplication = await generator.createApplication({ user_id: 13, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        for (const index in applications) {
            const application = applications[index];
            const entry = body[index];

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.user_id).toEqual(entry.user_id);
            expect(applicationFromDb.participant_type).toEqual(entry.participant_type);
            expect(applicationFromDb.participant_order).toEqual(entry.participant_order);
        }

        const extraApplicationFromDb = await Application.findByPk(extraApplication.id);
        expect(extraApplicationFromDb.participant_type).toEqual(null);
        expect(extraApplicationFromDb.participant_order).toEqual(null);
    });

    test('should set the board comment if it is provided', async () => {
        const application = await generator.createApplication({
            user_id: 10,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1, board_comment: 'Good guy.' },
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.board_comment).toEqual(body[0].board_comment);
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 403 if one of the applications is not found', async () => {
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed body_id', async () => {
        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/lalala',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if body is not an array', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries is not an array', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [false]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have participant orger', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', user_id: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have participant type', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_order: 1, user_id: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries does not have user ID', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', participant_order: 1, board_comment: 'test' }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 if any of the entries has user ID as not string', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'delegate', participant_order: 1, board_comment: 'test', user_id: false }]
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if info is invalid', async () => {
        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [{ participant_type: 'invalid', participant_order: 1, user_id: 10 }]
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns net error', async () => {
        mock.mockAll({ body: { netError: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns bad response', async () => {
        mock.mockAll({ body: { badResponse: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return an error if body query returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        await generator.createApplication({ user_id: 10, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 11, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);
        await generator.createApplication({ user_id: 12, body_id: regularUser.bodies[0].id, participant_type: null, participant_order: null }, event);

        const body = [
            { user_id: 10, participant_type: 'visitor', participant_order: 1 },
            { user_id: 11, participant_type: 'visitor', participant_order: 2 },
            { user_id: 12, participant_type: 'visitor', participant_order: 3 }
        ];

        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test.each([
        [1, [{ participant_type: 'delegate', participant_order: 1 }], 'Entry 1: user ID is not a number.'],
        [2, [{ user_id: 1, participant_type: 'delegate', participant_order: 1 }, 'second'], 'Entry 2: is not an object.'],
        [3, [
            { user_id: 1, participant_type: 'delegate', participant_order: 1 },
            { user_id: 2, participant_type: 'delegate', participant_order: 2 },
            { user_id: 3, participant_type: 'delegate' }
        ], 'Entry 3: participant order is not a number.']
    ])('should name entry %i in the message when that entry is invalid', async (number, body, message) => {
        const res = await request({
            path: '/events/' + event.id + '/applications/boardview/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(message);
    });

    const bodyId = regularUser.bodies[0].id;

    const setBoardview = (body, id = bodyId) => request({
        path: '/events/' + event.id + '/applications/boardview/' + id,
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    // The body of the user is an antenna, which sends at most 3 delegates to an Agora.
    describe('the participants limit of the body', () => {
        // One after the other: each application takes the next statutory ID of the event.
        const createApplications = async (count) => {
            const applications = [];
            for (let index = 0; index < count; index++) {
                applications.push(await generator.createApplication({
                    user_id: 10 + index,
                    body_id: bodyId,
                    participant_type: 'visitor',
                    participant_order: index + 1,
                    board_comment: 'Before'
                }, event));
            }

            return applications;
        };

        const asDelegates = (applications) => applications.map((application, index) => ({
            user_id: application.user_id,
            participant_type: 'delegate',
            participant_order: index + 1,
            board_comment: 'After'
        }));

        const expectUnchanged = async (applications) => {
            for (const application of applications) {
                const applicationFromDb = await Application.findByPk(application.id);
                expect(applicationFromDb.participant_type).toEqual('visitor');
                expect(applicationFromDb.participant_order).toEqual(application.participant_order);
                expect(applicationFromDb.board_comment).toEqual('Before');
            }
        };

        test('should accept as many delegates as the body may send', async () => {
            const applications = await createApplications(3);

            const res = await setBoardview(asDelegates(applications));

            expect(res.statusCode).toEqual(200);

            for (const [index, application] of applications.entries()) {
                const applicationFromDb = await Application.findByPk(application.id);
                expect(applicationFromDb.participant_type).toEqual('delegate');
                expect(applicationFromDb.participant_order).toEqual(index + 1);
                expect(applicationFromDb.board_comment).toEqual('After');
            }
        });

        test('should refuse more delegates than the body may send and change nothing', async () => {
            const applications = await createApplications(4);

            const res = await setBoardview(asDelegates(applications));

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: `Too much applications for body #${bodyId} for type "delegate": expected 3, got 4.`
            });

            // Also the three delegates that fit are not stored.
            await expectUnchanged(applications);
        });

        test('should refuse a participant type the body may not send and change nothing', async () => {
            const applications = await createApplications(2);

            const res = await setBoardview([
                { user_id: applications[0].user_id, participant_type: 'delegate', participant_order: 1 },
                { user_id: applications[1].user_id, participant_type: 'observer', participant_order: 1 }
            ]);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual(`Too much applications for body #${bodyId} for type "observer": expected 0, got 1.`);

            await expectUnchanged(applications);
        });

        // BUG: the message names the number of applications so far as the upper bound (1, where
        // the body may send 3 delegates) and calls the order the participant type.
        // Expected: "Expected participant number from 1 to 3, got 4", or similar.
        test('should refuse an order above the limit and change nothing', async () => {
            const applications = await createApplications(1);

            const res = await setBoardview([
                { user_id: applications[0].user_id, participant_type: 'delegate', participant_order: 4 }
            ]);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('Expected participant number from 1 to 1, got participant type 4');

            await expectUnchanged(applications);
        });

        test('should clear the applications of the body that the request leaves out', async () => {
            const [kept, cleared] = await createApplications(2);
            const otherBody = await generator.createApplication({
                user_id: 99,
                body_id: 1337,
                participant_type: 'visitor',
                participant_order: 1,
                board_comment: 'Before'
            }, event);

            const res = await setBoardview([{ user_id: kept.user_id, participant_type: 'delegate', participant_order: 1 }]);

            expect(res.statusCode).toEqual(200);

            const clearedFromDb = await Application.findByPk(cleared.id);
            expect(clearedFromDb.participant_type).toEqual(null);
            expect(clearedFromDb.participant_order).toEqual(null);
            expect(clearedFromDb.board_comment).toEqual(null);

            // The board comment of an application in the request is cleared too when it sends none.
            const keptFromDb = await Application.findByPk(kept.id);
            expect(keptFromDb.participant_type).toEqual('delegate');
            expect(keptFromDb.board_comment).toEqual(null);

            // Another body is not touched.
            const otherBodyFromDb = await Application.findByPk(otherBody.id);
            expect(otherBodyFromDb.participant_type).toEqual('visitor');
            expect(otherBodyFromDb.board_comment).toEqual('Before');
        });
    });

    // The board of a body sets the participant types from the start of the application period
    // until the board approve deadline, both ends included.
    describe('the board approve deadline', () => {
        let application;

        beforeEach(async () => {
            application = await generator.createApplication({
                user_id: 10,
                body_id: bodyId,
                participant_type: null,
                participant_order: null
            }, event);
        });

        const entries = [{ user_id: 10, participant_type: 'visitor', participant_order: 1 }];

        test.each([
            ['refuses a board member 1 ms before the application period starts', 'application_period_starts', -1, 403],
            ['lets a board member set the types exactly when the application period starts (inclusive)', 'application_period_starts', 0, 200],
            ['lets a board member set the types exactly at the board approve deadline (inclusive)', 'board_approve_deadline', 0, 200],
            ['refuses a board member 1 ms after the board approve deadline', 'board_approve_deadline', 1, 403]
        ])('%s', async (name, field, offset, status) => {
            // The core mock makes the user a board member of the body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await setBoardview(entries);

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(status === 200 ? 'visitor' : null);
        });

        test.each([
            ['1 ms before the application period starts', 'application_period_starts', -1],
            ['1 ms after the board approve deadline', 'board_approve_deadline', 1]
        ])('lets those who approve the members of all bodies set the types %s', async (name, field, offset) => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:approve_members:agora'] },
                approvePermissions: { noPermissions: true }
            });
            tk.freeze(moment(event[field]).add(offset, 'ms').toDate());

            const res = await setBoardview(entries);

            expect(res.statusCode).toEqual(200);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual('visitor');
        });
    });

    describe('who may set them without being in the board of the body', () => {
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
            const application = await generator.createApplication({
                user_id: 10,
                body_id: bodyId,
                participant_type: null,
                participant_order: null
            }, event);

            const res = await setBoardview([{ user_id: 10, participant_type: 'visitor', participant_order: 1 }]);

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            // Nothing is stored when the request is refused.
            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(status === 200 ? 'visitor' : null);
            expect(applicationFromDb.board_comment).toEqual(status === 200 ? null : application.board_comment);
        });

        test('should return 403 for a board member of another body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await generator.createApplication({ user_id: 10, body_id: 1337 }, event);

            const res = await setBoardview([{ user_id: 10, participant_type: 'visitor', participant_order: 1 }], 1337);

            expect(res.statusCode).toEqual(403);

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.participant_type).toEqual(application.participant_type);
        });
    });
});
