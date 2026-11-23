const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Application } = require('../../models');

const BOARD_COMMENT = 'A comment of the board about this applicant.';

// The board comment is written by the board of the applicant's body for those who select
// the participants. It is returned to them, not to the applicant.
describe('Board comment of an application', () => {
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
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    // A member without any permission, who is not in the board of a body either.
    const mockApplicant = () => mock.mockAll({
        mainPermissions: { noPermissions: true },
        approvePermissions: { noPermissions: true }
    });

    const createOwnApplication = () => generator.createApplication({
        user_id: regularUser.id,
        body_id: regularUser.bodies[0].id,
        board_comment: BOARD_COMMENT
    }, event);

    describe('for the applicant', () => {
        beforeEach(mockApplicant);

        test.each(['me', 'id'])('should not be returned when displaying the application by %s', async (by) => {
            const application = await createOwnApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/' + (by === 'me' ? 'me' : application.id),
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data).toHaveProperty('allergies');
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        test('should not be returned when editing the application, and should stay as it is', async () => {
            const application = await createOwnApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { allergies: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.allergies).toEqual('Changed');
            expect(res.body.data).not.toHaveProperty('board_comment');

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.board_comment).toEqual(BOARD_COMMENT);
        });

        test('should not be returned when applying', async () => {
            const res = await request({
                path: '/events/' + event.id + '/applications',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateApplication({ body_id: regularUser.bodies[0].id }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(regularUser.id);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        test('should not be returned when cancelling the application', async () => {
            const application = await createOwnApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/me/cancel',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { cancelled: true }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data.cancelled).toEqual(true);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });
    });

    describe('for those who select the participants', () => {
        const createApplication = () => generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            board_comment: BOARD_COMMENT
        }, event);

        test('should be returned to a board member of the applicant\'s body', async () => {
            // The default mock makes the user a board member of their first body.
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await createApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual(BOARD_COMMENT);
        });

        test('should be returned to a holder of the permission to manage applications', async () => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:manage_applications:agora'] },
                approvePermissions: { noPermissions: true }
            });
            const application = await generator.createApplication({ user_id: 1337, board_comment: BOARD_COMMENT }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual(BOARD_COMMENT);
        });

        test('should be returned in the board view to a holder of the permission to approve members of all bodies', async () => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:approve_members:agora'] },
                approvePermissions: { noPermissions: true }
            });
            const application = await generator.createApplication({ user_id: 1337, board_comment: BOARD_COMMENT }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/boardview/' + application.body_id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].board_comment).toEqual(BOARD_COMMENT);
        });

        test('should be returned to an applicant who is in the board of their body', async () => {
            // They can read it in the board view of their body as well.
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const application = await createOwnApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/me',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data.board_comment).toEqual(BOARD_COMMENT);
        });

        test('should be returned when a manager edits the application', async () => {
            const application = await createApplication();

            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { allergies: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual(BOARD_COMMENT);
        });
    });
});
