const xlsx = require('node-xlsx').default;

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const coreUser = require('../assets/oms-core-valid.json').data;
const applicant = require('../assets/oms-core-valid-not-superadmin.json').data;

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

// The organizer (user #1, board member of body 34) without any global permissions.
const organizerMocks = { mainPermissions: { noPermissions: true } };

// User #5, not an organizer, without any permissions.
const strangerMocks = { core: { notSuperadmin: true }, mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } };

// User #5 who can apply.
const applicantMocks = { ...strangerMocks, mainPermissions: { permissions: ['global:apply:summeruniversity'] } };

describe('Applications listing, viewing and exporting', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const get = (path, options = {}) => request({ path, method: 'GET', headers: { 'X-Auth-Token': 'foobar' }, ...options });

    describe('GET /single/:id/applications', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/single/' + event.id + '/applications');

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for a stranger', async () => {
            mock.mockAll(strangerMocks);

            const res = await get('/single/' + event.id + '/applications');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You cannot see applications for this event.');
        });

        test('should list all applications of this event to an organizer, oldest first', async () => {
            mock.mockAll(organizerMocks);
            const first = await generator.createApplication(event, { user_id: 10 });
            const second = await generator.createApplication(event, { user_id: 11 });
            await generator.createApplication(await generator.createEvent(), { user_id: 12 });

            const res = await get('/single/' + event.id + '/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.map((a) => a.id)).toEqual([first.id, second.id]);
        });

        test('should list the applications to a manager who is not an organizer', async () => {
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            await generator.createApplication(otherEvent, { user_id: 10 });

            const res = await get('/single/' + otherEvent.id + '/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
        });

        test('should return 403 for the applicant', async () => {
            mock.mockAll(applicantMocks);
            await generator.createApplication(event, { user_id: applicant.id });

            const res = await get('/single/' + event.id + '/applications');

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('GET /single/:id/applications/:application_id', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(401);
        });

        test('should return an application by id with user data from core', async () => {
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data.gender).toEqual(coreUser.gender);
            expect(res.body.data.date_of_birth).toEqual(coreUser.date_of_birth);
            expect(res.body.data.notification_email).toEqual(coreUser.notification_email);
            expect(res.body.permissions.view_application).toEqual(true);
            expect(res.body.permissions.edit_application).toEqual(true);
        });

        test('should return the own application with /me', async () => {
            mock.mockAll(applicantMocks);
            const application = await generator.createApplication(event, { user_id: 5 });
            await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/me');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.permissions.edit_application).toEqual(true);
            expect(res.body.permissions.set_application_cancelled).toEqual(true);
        });

        test('should return 404 for /me if the user has not applied', async () => {
            const res = await get('/single/' + event.id + '/applications/me');

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual('Application with id me not found');
        });

        test('should return 400 on an invalid application id', async () => {
            const res = await get('/single/' + event.id + '/applications/abc');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('Application ID should be either a number or me');
        });

        test('should return 404 if the application does not exist', async () => {
            const res = await get('/single/' + event.id + '/applications/1337');

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual('Application with id 1337 not found');
        });

        test('should return 404 if the application belongs to another event', async () => {
            const application = await generator.createApplication(await generator.createEvent(), { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(404);
        });

        test('should return 404 if the event does not exist', async () => {
            const res = await get('/single/1337/applications/1');

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual('Event with id 1337 not found');
        });

        test('should return 403 for a stranger viewing somebody else\'s application', async () => {
            mock.mockAll(strangerMocks);
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to see this application.');
        });

        test('should allow a board member to view an application from their body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const application = await generator.createApplication(otherEvent, { user_id: 10, body_id: 34 });

            const res = await get('/single/' + otherEvent.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.permissions.edit_application).toEqual(false);
        });

        test('should allow a holder of the global boardview permission to view an application', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_members:summeruniversity'] }, approvePermissions: { noPermissions: true } });
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const application = await generator.createApplication(otherEvent, { user_id: 10, body_id: 1 });

            const res = await get('/single/' + otherEvent.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.permissions.edit_application).toEqual(false);
        });

        test('should not allow a board member to view an application from another body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const application = await generator.createApplication(otherEvent, { user_id: 10, body_id: 1 });

            const res = await get('/single/' + otherEvent.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(403);
        });

        test('should return 500 if fetching the applicant from core fails', async () => {
            mock.mockAll({ member: { unsuccessfulResponse: true } });
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Error fetching user');
        });

        test('should return 500 if core returns garbage for the applicant', async () => {
            mock.mockAll({ member: { badResponse: true } });
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Malformed response when fetching user');
        });

        test('should return 500 naming the malformed response if core returns an empty body for the applicant', async () => {
            mock.mockAll({ member: { emptyResponse: true } });
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toEqual('Malformed response when fetching user: null');
        });

        test('should return 500 if the core login fails', async () => {
            mock.mockAll({ login: { badResponse: true } });
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Malformed response when fetching auth request');
        });

        test('should return 500 if the core login is unsuccessful', async () => {
            mock.mockAll({ login: { unsuccessfulResponse: true } });
            const application = await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Error fetching auth request');
        });

        test('should show an application with the applicant data to a manager who is not an organizer', async () => {
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            const application = await generator.createApplication(otherEvent, { user_id: 10 });

            const res = await get('/single/' + otherEvent.id + '/applications/' + application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.gender).toEqual(coreUser.gender);
            expect(res.body.data.date_of_birth).toEqual(coreUser.date_of_birth);
            expect(res.body.data.notification_email).toEqual(coreUser.notification_email);
            expect(res.body.permissions.view_application).toEqual(true);
        });
    });

    describe('GET /single/:id/applications/export', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/single/' + event.id + '/applications/export');

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for a stranger', async () => {
            mock.mockAll(strangerMocks);

            const res = await get('/single/' + event.id + '/applications/export');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to export participants.');
        });

        test('should export the active applications as XLSX for an organizer', async () => {
            mock.mockAll(organizerMocks);
            const exportEvent = await generator.createEvent({ name: 'Export SU', questions: [{ description: 'Why?' }, { description: 'How?' }] });
            await generator.createApplication(exportEvent, { user_id: 10, first_name: 'Pending', confirmed: true });
            await generator.createApplication(exportEvent, { user_id: 11, first_name: 'Accepted', status: 'accepted' });
            await generator.createApplication(exportEvent, { user_id: 12, first_name: 'Rejected', status: 'rejected' });
            await generator.createApplication(exportEvent, { user_id: 13, first_name: 'Cancelled', cancelled: true });

            const res = await get('/single/' + exportEvent.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res.headers['content-disposition']).toMatch(/^attachment; filename="participants_Export SU_.*\.xlsx"$/);

            const [sheet] = xlsx.parse(res.body);
            expect(sheet.name).toEqual('Participants');

            const [headers, ...rows] = sheet.data;
            expect(headers).toContain('First name');
            expect(headers).toContain('Email address');
            expect(headers).toContain('Answer 1: Why?');
            expect(headers).toContain('Answer 2: How?');
            expect(rows.length).toEqual(2);

            const firstNameIndex = headers.indexOf('First name');
            const confirmedIndex = headers.indexOf('Confirmed?');
            const emailIndex = headers.indexOf('Email address');
            const byName = Object.fromEntries(rows.map((row) => [row[firstNameIndex], row]));
            expect(Object.keys(byName).sort()).toEqual(['Accepted', 'Pending']);
            expect(byName.Pending[confirmedIndex]).toEqual('Yes');
            expect(byName.Accepted[confirmedIndex]).toEqual('No');
            expect(byName.Pending[emailIndex]).toEqual(coreUser.notification_email);
        });

        test('should log in to core once for the whole export', async () => {
            const logins = mock.captureRequests(mock.mockAll().omsCoreLoginStub);
            for (const userId of [10, 11, 12]) {
                await generator.createApplication(event, { user_id: userId });
            }

            const res = await get('/single/' + event.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            expect(logins.length).toEqual(1);
        });

        test('should export an empty sheet if there are no applications', async () => {
            const res = await get('/single/' + event.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            const [sheet] = xlsx.parse(res.body);
            expect(sheet.data.length).toEqual(1);
        });

        // BUG: the event name is put into the Content-Disposition header unescaped, so
        // a name with characters outside latin1 makes res.setHeader throw.
        test('should export an event whose name has characters outside latin1', async () => {
            const exportEvent = await generator.createEvent({ name: 'Summer in İstanbul — 2026' });

            const res = await get('/single/' + exportEvent.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-disposition']).toMatch(/^attachment; filename="participants_Summer in \?stanbul \? 2026_.*\.xlsx"; filename\*=UTF-8''participants_Summer%20in%20%C4%B0stanbul%20%E2%80%94%202026_.*\.xlsx$/);
        });

        test('should quote an event name with separators in the file name', async () => {
            const exportEvent = await generator.createEvent({ name: 'Sun; sea "and" fun' });

            const res = await get('/single/' + exportEvent.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-disposition']).toMatch(/^attachment; filename="participants_Sun; sea \\"and\\" fun_.*\.xlsx"$/);
        });

        test('should return 500 if fetching an applicant from core fails', async () => {
            mock.mockAll({ member: { unsuccessfulResponse: true } });
            await generator.createApplication(event, { user_id: 10 });

            const res = await get('/single/' + event.id + '/applications/export');

            expect(res.statusCode).toEqual(500);
        });

        test('should return 403 for the applicant', async () => {
            mock.mockAll(applicantMocks);
            await generator.createApplication(event, { user_id: applicant.id });

            const res = await get('/single/' + event.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(403);
        });

        test('should export to a manager who is not an organizer, without rejected and cancelled applications', async () => {
            const otherEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
            await generator.createApplication(otherEvent, { user_id: 10, first_name: 'Pending' });
            await generator.createApplication(otherEvent, { user_id: 11, first_name: 'Rejected', status: 'rejected' });
            await generator.createApplication(otherEvent, { user_id: 12, first_name: 'Cancelled', cancelled: true });

            const res = await get('/single/' + otherEvent.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            const [sheet] = xlsx.parse(res.body);
            const [headers, ...rows] = sheet.data;
            expect(rows.map((row) => row[headers.indexOf('First name')])).toEqual(['Pending']);
        });

        test('should export only the fixed columns for an event without questions', async () => {
            const noQuestions = await generator.createEvent({ questions: [] });
            await generator.createApplication(noQuestions, { user_id: 10, answers: [] });

            const res = await get('/single/' + noQuestions.id + '/applications/export', { responseType: 'buffer' });

            expect(res.statusCode).toEqual(200);
            const [sheet] = xlsx.parse(res.body);
            expect(sheet.data[0]).toEqual(Object.values(constants.APPLICATION_FIELD_NAMES));
        });
    });
    describe('board comment', () => {
        const ownApplicantMocks = { ...applicantMocks, member: { data: applicant } };
        let ownEvent;

        beforeEach(async () => {
            ownEvent = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
        });

        const call = (subpath, method, body) => request({
            path: '/single/' + ownEvent.id + '/applications' + subpath,
            method,
            headers: { 'X-Auth-Token': 'foobar' },
            body
        });

        test('should not show the board comment to the applicant', async () => {
            mock.mockAll(ownApplicantMocks);
            await generator.createApplication(ownEvent, { user_id: applicant.id, body_id: 1, board_comment: 'Board only' });

            const res = await call('/me', 'GET');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(applicant.id);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        test('should show the board comment to someone who may list the applications', async () => {
            const application = await generator.createApplication(ownEvent, { user_id: applicant.id, body_id: 1, board_comment: 'Board only' });

            const res = await call('/' + application.id, 'GET');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.board_comment).toEqual('Board only');
        });

        test('should not show the board comment in the answer to the applicant\'s edit', async () => {
            mock.mockAll(ownApplicantMocks);
            await generator.createApplication(ownEvent, { user_id: applicant.id, body_id: 1, board_comment: 'Board only' });

            const res = await call('/me', 'PUT', { motivation: 'Changed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        test('should not show the board comment in the answer to the applicant\'s cancellation', async () => {
            mock.mockAll(ownApplicantMocks);
            await generator.createApplication(ownEvent, { user_id: applicant.id, body_id: 1, board_comment: 'Board only' });

            const res = await call('/me/cancelled', 'PUT', { cancelled: true });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.cancelled).toEqual(true);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });

        test('should not show the board comment in the answer to the application', async () => {
            mock.mockAll(ownApplicantMocks);

            const res = await call('', 'POST', generator.generateApplicationBody(ownEvent, { body_id: 1 }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.user_id).toEqual(applicant.id);
            expect(res.body.data).not.toHaveProperty('board_comment');
        });
    });
});
