const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const coreUser = require('../assets/oms-core-valid.json').data;
const applicant = require('../assets/oms-core-valid-not-superadmin.json').data;

// User #5 (member of bodies 9, 173 and 1) who can apply to SUs. The applicant's details
// are fetched from core's /members/:id, so that returns user #5 as well.
const applicantMocks = {
    core: { notSuperadmin: true },
    mainPermissions: { permissions: ['global:apply:summeruniversity'] },
    approvePermissions: { noPermissions: true },
    member: { data: applicant }
};

// User #1 (superadmin, member of bodies 34 and 9) editing user #5's application.
const managerMocks = { member: { data: applicant } };

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
        expect(mails[0].to).toEqual(applicant.notification_email);
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
        expect(res.body.message).toEqual('The applicant is not a member of this body.');
    });

    test('should ignore the fields the applicant cannot set', async () => {
        const res = await edit({
            status: 'accepted',
            board_comment: 'Great!',
            confirmed: true,
            attended: true,
            cancelled: true,
            body_name: 'Fake body'
        });

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.status).toEqual('pending');
        expect(application.board_comment).toEqual(null);
        expect(application.confirmed).toEqual(false);
        expect(application.attended).toEqual(false);
        expect(application.cancelled).toEqual(false);
        expect(application.body_name).toEqual('AEGEE-Dresden');
    });

    test('should return 403 if the applications are closed', async () => {
        await event.update({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot edit this application.');
    });

    test('should not let the applicant edit their application on a deleted event', async () => {
        await event.update({ deleted: true });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot edit this application.');

        const fromDb = await Application.findByPk(application.id);
        expect(fromDb.motivation).not.toEqual('Changed');
    });

    test('should answer with the stored values, not the ones sent', async () => {
        const res = await edit({ body_id: '1' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toEqual(1);
        expect(res.body.data.notification_email).toEqual(applicant.notification_email);
    });

    test('should return 403 if the applicant is already accepted', async () => {
        await application.update({ status: 'accepted' });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(403);
        await application.reload();
        expect(application.motivation).not.toEqual('Changed');
    });

    test('should let the applicant edit a rejected application while the applications are open', async () => {
        await application.update({ status: 'rejected' });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.motivation).toEqual('Changed');
        expect(res.body.data.status).toEqual('rejected');
    });

    test('should only notify the applicant and the organizers if the body has no board members', async () => {
        mockAndCapture({ ...applicantMocks, bodyMembers: { data: [] } });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(mails.map((mail) => mail.template)).toEqual([
            'summeruniversity_application_edited.html',
            'summeruniversity_organizer_edited.html'
        ]);
    });

    test('should let an organizer edit an application while the event is in second submission', async () => {
        mockAndCapture({ mainPermissions: { noPermissions: true }, member: { data: applicant } });
        const organized = await generator.createEvent({ status: 'second submission', published: 'minimal' });
        const other = await generator.createApplication(organized, { user_id: applicant.id, body_id: 1, body_name: 'AEGEE-Dresden' });

        const res = await request({
            path: '/single/' + organized.id + '/applications/' + other.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'foobar' },
            body: { answers: ['Changed by the organizer'] }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.answers).toEqual(['Changed by the organizer']);
    });

    test('should let a banned applicant edit their application (the ban is not checked)', async () => {
        mockAndCapture({
            ...applicantMocks,
            core: { data: { ...applicant, event_application_ban: { ban_until: generator.daysFromNow(365) } } }
        });

        const res = await edit({ motivation: 'Changed' });

        expect(res.statusCode).toEqual(200);
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

    test('should keep the applicant\'s details when a manager edits the application', async () => {
        mockAndCapture(managerMocks);

        const res = await edit({ motivation: 'Changed by manager', user_id: coreUser.id, first_name: 'Hacker' });

        expect(res.statusCode).toEqual(200);
        const dbApplication = await Application.findByPk(application.id);
        expect(dbApplication.motivation).toEqual('Changed by manager');
        expect(dbApplication.user_id).toEqual(applicant.id);
        expect(dbApplication.first_name).toEqual(applicant.first_name);
        expect(dbApplication.last_name).toEqual(applicant.last_name);
        expect(dbApplication.body_name).toEqual('AEGEE-Dresden');

        // The applicant is notified, not the manager.
        expect(mails[0].template).toEqual('summeruniversity_application_edited.html');
        expect(mails[0].to).toEqual(applicant.notification_email);
    });

    test('should let a manager move the application to another body of the applicant', async () => {
        mockAndCapture(managerMocks);

        const res = await edit({ body_id: 173 });

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.body_id).toEqual(173);
        expect(application.body_name).toEqual('AEGEE-Voronezh');
        expect(application.user_id).toEqual(applicant.id);
    });

    test('should not let a manager move the application to a body of their own', async () => {
        mockAndCapture(managerMocks);

        // Body 34 is one of the manager's bodies, but not one of the applicant's.
        const res = await edit({ body_id: 34 });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('The applicant is not a member of this body.');
        await application.reload();
        expect(application.body_id).toEqual(1);
    });

    test('should let a manager edit the application of someone who left the body they applied with', async () => {
        // The applicant is no longer a member of body 1, which the application is for.
        mockAndCapture({ member: { data: { ...applicant, bodies: applicant.bodies.filter((body) => body.id !== 1) } } });

        // The form sends the whole application back, including the current body (as a string here).
        const res = await edit({ body_id: '1', motivation: 'Changed by manager' });

        expect(res.statusCode).toEqual(200);
        await application.reload();
        expect(application.body_id).toEqual(1);
        expect(application.body_name).toEqual('AEGEE-Dresden');
        expect(application.motivation).toEqual('Changed by manager');
    });
});
