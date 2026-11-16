const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application, Event } = require('../../models');
const applicant = require('../assets/oms-core-valid-not-superadmin.json').data;

// User #5 (member of bodies 9, 173 and 1) who can apply to SUs.
const applicantMocks = {
    core: { notSuperadmin: true },
    mainPermissions: { permissions: ['global:apply:summeruniversity'] },
    approvePermissions: { noPermissions: true }
};

describe('Applications creation', () => {
    let event;
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
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const mockAndCapture = (options) => {
        mails = mock.captureMails(mock.mockAll(options).omsMailerStub);
    };

    const apply = (body, eventId = event.id) => request({
        path: '/single/' + eventId + '/applications',
        method: 'POST',
        headers: { 'X-Auth-Token': 'foobar' },
        body
    });

    test('should return 401 if the user is not authenticated', async () => {
        mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(401);
        expect(await Application.count()).toEqual(0);
    });

    test('should return 404 if the event does not exist', async () => {
        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }), 1337);

        expect(res.statusCode).toEqual(404);
    });

    test('should create an application and notify the user, organizers and board', async () => {
        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual('Application is created.');
        expect(res.body.data.user_id).toEqual(applicant.id);
        expect(res.body.data.event_id).toEqual(event.id);
        expect(res.body.data.first_name).toEqual(applicant.first_name);
        expect(res.body.data.last_name).toEqual(applicant.last_name);
        expect(res.body.data.body_id).toEqual(1);
        expect(res.body.data.body_name).toEqual('AEGEE-Dresden');
        expect(res.body.data.status).toEqual('pending');

        expect(await Application.count()).toEqual(1);

        expect(mails.map((mail) => mail.template)).toEqual([
            'summeruniversity_applied.html',
            'summeruniversity_organizer_applied.html',
            'summeruniversity_board_applied.html'
        ]);
        expect(mails[0].to).toEqual(applicant.notification_email);
        expect(mails[2].to).toEqual(['admin@aegee.org']);
    });

    test('should not send the board mail if there are no board members', async () => {
        mockAndCapture({ ...applicantMocks, bodyMembers: { data: [] } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(200);
        expect(mails.map((mail) => mail.template)).toEqual([
            'summeruniversity_applied.html',
            'summeruniversity_organizer_applied.html'
        ]);
    });

    test('should ignore the fields the applicant cannot set', async () => {
        const res = await apply(generator.generateApplicationBody(event, {
            body_id: 1,
            status: 'accepted',
            board_comment: 'Great!',
            confirmed: true,
            attended: true,
            cancelled: true,
            body_name: 'Fake body'
        }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('pending');

        const application = await Application.findByPk(res.body.data.id);
        expect(application.status).toEqual('pending');
        expect(application.board_comment).toEqual(null);
        expect(application.confirmed).toEqual(false);
        expect(application.attended).toEqual(false);
        expect(application.cancelled).toEqual(false);
        expect(application.body_name).toEqual('AEGEE-Dresden');
    });

    test('should override the user and event fields from the body', async () => {
        const otherEvent = await generator.createEvent();
        const res = await apply(generator.generateApplicationBody(event, { body_id: 1, user_id: 1337, event_id: otherEvent.id, first_name: 'Fake' }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.user_id).toEqual(applicant.id);
        expect(res.body.data.event_id).toEqual(event.id);
        expect(res.body.data.first_name).toEqual(applicant.first_name);
    });

    test('should return 403 if the user has no apply permission', async () => {
        mockAndCapture({ ...applicantMocks, mainPermissions: { noPermissions: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You cannot apply to this event.');
    });

    test('should return 403 if the applications are closed', async () => {
        await event.update({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(403);
    });

    test('should allow applying during an open call even if the application period is over', async () => {
        await event.update({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10), open_call: true });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(200);
    });

    test('should return 403 if the user already applied to another 2026 event', async () => {
        const otherEvent = await generator.createEvent();
        await generator.createApplication(otherEvent, { user_id: applicant.id });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(403);
    });

    test('should return 403 if the user is banned from applying', async () => {
        mockAndCapture({ core: { eventApplicationBanned: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 34 }));

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('You are temporarily banned from applying to events.');
        expect(await Application.count()).toEqual(0);
    });

    test('should allow applying if the ban has expired', async () => {
        mockAndCapture({ core: { expiredApplicationBan: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 34 }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_name).toEqual('AEGEE-Alicante');
    });

    test('should return 400 if the user is not a member of the body', async () => {
        const res = await apply(generator.generateApplicationBody(event, { body_id: 34 }));

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toEqual('You are not a member of this body.');
    });

    // BUG: createApplication looks up the body name with req.user.bodies.find(...).name
    // without checking that body_id was given, so a missing body_id crashes with a 500
    // instead of returning a validation error.
    test('should currently return 500 if the body_id is missing', async () => {
        const body = generator.generateApplicationBody(event, { body_id: 1 });
        delete body.body_id;

        const res = await apply(body);

        expect(res.statusCode).toEqual(500);
        expect(await Application.count()).toEqual(0);
    });

    test('should return 422 if the user applies twice to the same event', async () => {
        await generator.createApplication(event, { user_id: applicant.id });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.user_id).toEqual(['The application for this event from this user already exists.']);
        expect(await Application.count()).toEqual(1);
    });

    test.each([
        ['nationality', { nationality: '' }, 'Nationality should be set.'],
        ['travelling_from', { travelling_from: '' }, 'Travelling from should be set.'],
        ['meals', { meals: '' }, 'Meals should be set.'],
        ['answers', { answers: 'not an array' }, 'Answers should be an array of strings.'],
        ['answers', { answers: ['one', 'two'] }, 'Expected 1 answers, but got 2.'],
        ['agreed_to_privacy_policy', { agreed_to_privacy_policy: false }, 'You should agree to Privacy Policy.'],
        ['agreed_to_su_terms', { agreed_to_su_terms: false }, null],
        ['visa_required', { visa_required: 'yes' }, 'The value should be true or false.'],
        ['motivation', { motivation: null }, null],
    ])('should return 422 on an invalid %s', async (field, overrides, message) => {
        const res = await apply(generator.generateApplicationBody(event, { body_id: 1, ...overrides }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty(field);
        if (message) {
            expect(res.body.errors[field]).toContain(message);
        }
        expect(await Application.count()).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test('should return 422 if a visa is required but the visa fields are missing', async () => {
        const res = await apply(generator.generateApplicationBody(event, { body_id: 1, visa_required: true, visa_place_of_birth: 'Somewhere' }));

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors.visaFieldsFilledIn).toEqual(['Visa is required, but visa_passport_number is not set.']);
    });

    test('should accept an application with all visa fields', async () => {
        const visa = {
            visa_required: true,
            visa_place_of_birth: 'Dresden',
            visa_passport_number: '123',
            visa_passport_issue_date: '2020-01-01',
            visa_passport_expiration_date: '2030-01-01',
            visa_passport_issue_authority: 'Authority',
            visa_embassy: 'Embassy',
            visa_street_and_house: 'Street 1',
            visa_postal_code: '01234',
            visa_city: 'Dresden',
            visa_country: 'Germany'
        };

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1, ...visa }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.visa_required).toEqual(true);
    });

    test('should return 500 and not create the application if the mailer fails', async () => {
        mockAndCapture({ ...applicantMocks, mailer: { netError: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(500);
        expect(await Application.count()).toEqual(0);
    });

    test('should return 500 and not create the application if fetching the board members fails', async () => {
        mockAndCapture({ ...applicantMocks, bodyMembers: { unsuccessfulResponse: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Error fetching members for permission');
        expect(await Application.count()).toEqual(0);
    });

    test('should return 500 if core returns garbage for the board members', async () => {
        mockAndCapture({ ...applicantMocks, bodyMembers: { badResponse: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(500);
        expect(res.body.message).toContain('Malformed response when fetching members for permission');
    });

    test('should return 500 if the core login fails', async () => {
        mockAndCapture({ ...applicantMocks, login: { netError: true } });

        const res = await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        expect(res.statusCode).toEqual(500);
        expect(await Application.count()).toEqual(0);
    });

    test('should not change the event', async () => {
        await apply(generator.generateApplicationBody(event, { body_id: 1 }));

        const dbEvent = await Event.findByPk(event.id);
        expect(dbEvent.organizers).toEqual(event.organizers);
    });
});
