const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const bodies = require('../assets/core-bodies.json').data;
const knownMails = require('../assets/core-notification-mails.json').data;

// What the fixtures say about the applicant's body and about user 2.
const bodyCode = bodies.find((body) => body.id === regularUser.bodies[0].id).code;
const applicantMail = knownMails.find((mail) => mail.id === 2).notification_email;

// The notification emails of applicants and candidates come from core. When core does not
// give them (it refuses the lookup, or it does not know the user), the lists and the
// exports still answer, without the addresses.
describe('Notification emails that core does not give', () => {
    let event;
    let application;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        event = await generator.createEvent({ type: 'agora', applications: [] });
        application = await generator.createApplication({
            user_id: 2,
            body_id: regularUser.bodies[0].id,
            first_name: 'Anna',
            last_name: 'Applicant',
            status: 'accepted',
            participant_type: 'delegate',
            participant_order: 1
        }, event);
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const get = (path, options = {}) => request({
        path: '/events/' + event.id + path,
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' },
        ...options
    });

    describe.each([
        ['refuses the lookup', { forbidden: true }],
        ['does not know the users', { empty: true }],
        ['answers with an error', { unsuccessfulResponse: true }]
    ])('when core %s', (description, mails) => {
        beforeEach(() => {
            mock.mockAll({ mails });
        });

        test.each([
            '/applications/all',
            '/applications/incoming',
            '/applications/boardview/' + regularUser.bodies[0].id
        ])('should list %s without the addresses', async (path) => {
            const res = await get(path);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0]).not.toHaveProperty('notification_email');
        });

        test('should display a single application without the address', async () => {
            const res = await get('/applications/' + application.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(application.id);
            expect(res.body.data).not.toHaveProperty('notification_email');
        });

        test('should set a flag of an application', async () => {
            const res = await request({
                path: '/events/' + event.id + '/applications/' + application.id + '/confirmed',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { confirmed: true }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.confirmed).toEqual(true);
        });

        test('should export the applications with an empty address', async () => {
            const res = await get('/applications/export/all', {
                responseType: 'buffer',
                query: { select: ['first_name', 'notification_email'] }
            });

            expect(res.statusCode).toEqual(200);

            const [sheet] = xlsx.parse(res.body);
            expect(sheet.data.length).toEqual(2);
            expect(sheet.data[1][0]).toEqual('Anna');
            expect(sheet.data[1][1]).toBeUndefined();
        });

        test('should export the candidates with an empty address', async () => {
            const position = await generator.createPosition({}, event);
            await generator.createCandidate({ user_id: 2, first_name: 'Carla' }, position);

            const res = await get('/positions/export', {
                responseType: 'buffer',
                query: { select: ['first_name', 'notification_email'] }
            });

            expect(res.statusCode).toEqual(200);

            const [sheet] = xlsx.parse(res.body);
            expect(sheet.data.length).toEqual(2);
            expect(sheet.data[1][0]).toEqual('Carla');
            expect(sheet.data[1][1]).toBeUndefined();
        });

        test('should export the participants for OpenSlides with an empty address', async () => {
            const res = await get('/applications/export/openslides', { responseType: 'text' });

            expect(res.statusCode).toEqual(200);

            const lines = res.body.split('\n').filter((line) => line.length > 0);
            expect(lines.length).toEqual(2);
            expect(lines[1]).toContain('"Anna","Applicant"');
            expect(lines[1].endsWith(',""')).toEqual(true);
        });

        test('should export the delegates with an empty address', async () => {
            const res = await get('/applications/export/delegates_jc', { responseType: 'text' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual(`${application.statutory_id};;Anna;Applicant;${bodyCode};delegate`);
        });

        test('should not send a mass mail and say why', async () => {
            const res = await request({
                path: '/events/' + event.id + '/massmailer',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { subject: 'Testing', text: 'Testing mail sending.' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Could not find the email addresses of the users matching this filter.');
        });
    });

    test('should export a delegate whose body core does not list with an empty body code', async () => {
        mock.mockAll({ bodies: { empty: true } });

        const res = await get('/applications/export/delegates_jc', { responseType: 'text' });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(`${application.statutory_id};${applicantMail};Anna;Applicant;;delegate`);
    });
});
