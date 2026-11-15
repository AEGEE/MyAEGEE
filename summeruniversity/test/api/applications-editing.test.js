const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const coreUser = require('../assets/oms-core-valid.json').data;
const applicant = require('../assets/oms-core-valid-not-superadmin.json').data;

// User #5 (member of bodies 9, 173 and 1) who can apply to SUs.
const applicantMocks = {
    core: { notSuperadmin: true },
    mainPermissions: { permissions: ['global:apply:summeruniversity'] },
    approvePermissions: { noPermissions: true }
};

describe('Applications editing', () => {
    let event;
    let application;
    let mails;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mails = mock.captureMails(mock.mockAll(applicantMocks).omsMailerStub);
        event = await generator.createEvent({ organizers: generator.generateOrganizers(9999) });
        application = await generator.createApplication(event, {
            user_id: applicant.id,
            first_name: applicant.first_name,
            last_name: applicant.last_name,
            body_id: 1,
            body_name: 'AEGEE-Dresden'
        });
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const mockAndCapture = (options) => {
        mails = mock.captureMails(mock.mockAll(options).omsMailerStub);
    };

    const edit = (body, applicationId = application.id) => request({
        path: '/single/' + event.id + '/applications/' + applicationId,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'foobar' },
        body
    });

    test('should return 401 if the user is not authenticated', async () => {
        mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(401);
    });

    test('should return 404 if the application does not exist', async () => {
        const res = await edit({ motivation: 'Changed' }, 1337);

        expect(res.statusCode).toEqual(404);
    });

    test('should allow the user to edit their own application and notify everyone', async () => {
        const res = await edit({ motivation: 'Changed motivation' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual('Application is updated');
        expect(res.body.data.motivation).toEqual('Changed motivation');

        await application.reload();
        expect(application.motivation).toEqual('Changed motivation');

        expect(mails.map((mail) => mail.template)).toEqual([
            'summeruniversity_application_edited.html',
            'summeruniversity_organizer_edited.html',
            'summeruniversity_board_edited.html'
        ]);
        // The applicant is fetched from core's /members/:id, which is mocked to always return user #1.
        expect(mails[0].to).toEqual(coreUser.notification_email);
    });

    test('should allow the user to edit their own application with /me', async () => {
        const res = await edit({ motivation: 'Changed via me' }, 'me');

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.motivation).toEqual('Changed via me');
    });

    test('should allow changing the body to another body of the user', async () => {
        const res = await edit({ body_id: 173 });

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.body_id).toEqual(173);
        expect(application.body_name).toEqual('AEGEE-Voronezh');
    });

    test('should return 403 if the user is not a member of the new body', async () => {
        const res = await edit({ body_id: 34 });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You are not a member of this body.');
    });

    test('should ignore the status and board comment from the body', async () => {
        const res = await edit({ status: 'accepted', board_comment: 'Great!' });

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.status).toEqual('pending');
        expect(application.board_comment).toEqual(null);
    });

    test('should return 403 if the applications are closed', async () => {
        await event.update({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot edit this application.');
    });

    test('should return 403 for a stranger editing somebody else\'s application', async () => {
        const other = await generator.createApplication(event, { user_id: 10 });

        const res = await edit({ motivation: 'Changed' }, other.id);

        expect(res.statusCode).toEqual(403);
    });

    test('should return 422 on validation errors and not change the application', async () => {
        const res = await edit({ answers: ['too', 'many'], motivation: 'Changed' });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.answers).toEqual(['Expected 1 answers, but got 2.']);
        await application.reload();
        expect(application.motivation).not.toEqual('Changed');
        expect(mails.length).toEqual(0);
    });

    test('should return 500 and roll back if the mailer fails', async () => {
        mockAndCapture({ ...applicantMocks, mailer: { unsuccessfulResponse: true } });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(500);
        await application.reload();
        expect(application.motivation).not.toEqual('Changed');
    });

    // BUG: updateApplication always overwrites user_id, first_name and last_name with the
    // editing user's data (see the TODO in the code), so a manager editing somebody
    // else's application takes it over.
    test('should currently reassign the application to a manager who edits it', async () => {
        mockAndCapture({});

        const res = await edit({ motivation: 'Changed by manager' });

        expect(res.statusCode).toEqual(200);
        const dbApplication = await Application.findByPk(application.id);
        expect(dbApplication.motivation).toEqual('Changed by manager');
        expect(dbApplication.user_id).toEqual(coreUser.id);
        expect(dbApplication.first_name).toEqual(coreUser.first_name);
    });
});
