const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const callers = require('../scripts/callers');

describe('Events application info', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should show an application with the applicant\'s email to an organizer without permissions', async () => {
        callers.asMember();
        const event = await generator.createEvent({ organizers: [callers.organizer(callers.member)] });
        const application = await generator.createApplication(event, { user_id: user.id });

        const res = await request({ path: '/single/' + event.id + '/applications/' + application.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.notification_email).toEqual(user.notification_email);
    });

    test.each([
        ['an unsuccessful answer', { unsuccessfulResponse: true }],
        ['an answer that is not JSON', { badResponse: true }],
    ])('should return 500 if core gives %s for the applicant', async (_, member) => {
        mock.mockAll({ member });
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { user_id: user.id });

        const res = await request({ path: '/single/' + event.id + '/applications/' + application.id, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should return 404 if application is not found', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 403 when not having the global permission and trying to edit other application', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }]
        });
        const application = await generator.createApplication(event, { user_id: 1337 });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should display my application', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication(event, { user_id: user.id });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    it('should display other user application if have global permission', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { user_id: user.id });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });
    describe('board comment', () => {
        // User #1 applies with body 9 (not a body they are board of) to an event they do not organize.
        const applicantMocks = { mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } };
        const organizers = [{ user_id: 1234, first_name: 'Some', last_name: 'Organizer' }];
        const openEvent = () => generator.createEvent({
            organizers,
            status: 'published',
            application_starts: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            application_ends: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            questions: []
        });

        it('should not show the board comment to the applicant', async () => {
            mock.mockAll(applicantMocks);
            const event = await openEvent();
            await generator.createApplication(event, { user_id: user.id, body_id: 9, board_comment: 'Board only' });

            const res = await request({
                path: '/single/' + event.id + '/applications/me',
                headers: { 'X-Auth-Token': 'foobar' },
                openApiVariant: 'ApplicationWithEmailForApplicant'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(user.id);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        it('should show the board comment to an applicant who may set it for that body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await openEvent();
            await generator.createApplication(event, { user_id: user.id, body_id: 34, board_comment: 'Board only' });

            const res = await request({
                path: '/single/' + event.id + '/applications/me',
                headers: { 'X-Auth-Token': 'foobar' },
                openApiVariant: 'ApplicationWithEmail'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual('Board only');
        });

        it('should show the board comment to someone who may list the applications', async () => {
            mock.mockAll({ approvePermissions: { noPermissions: true } });
            const event = await openEvent();
            const application = await generator.createApplication(event, { user_id: 1337, body_id: 9, board_comment: 'Board only' });

            const res = await request({
                path: '/single/' + event.id + '/applications/' + application.id,
                headers: { 'X-Auth-Token': 'foobar' },
                openApiVariant: 'ApplicationWithEmail'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual('Board only');
        });

        it('should not show the board comment in the answer to the applicant\'s edit', async () => {
            mock.mockAll(applicantMocks);
            const event = await openEvent();
            await generator.createApplication(event, { user_id: user.id, body_id: 9, board_comment: 'Board only', answers: [] });

            const res = await request({
                path: '/single/' + event.id + '/applications/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'foobar' },
                body: { agreed_to_privacy_policy: true },
                openApiVariant: 'ApplicationWithEmailForApplicant'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        it('should not show the board comment in the answer to the application', async () => {
            mock.mockAll(applicantMocks);
            const event = await openEvent();

            const res = await request({
                path: '/single/' + event.id + '/applications',
                method: 'POST',
                headers: { 'X-Auth-Token': 'foobar' },
                body: { body_id: 9, answers: [], agreed_to_privacy_policy: true },
                openApiVariant: 'ApplicationForApplicant'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(user.id);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });
    });
});
