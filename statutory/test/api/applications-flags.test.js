const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const { Application } = require('../../models');

// The routes that set one flag of an application answer with the application as the
// caller may see it in their own listing: the incoming, juridical and network officers
// get the fields of their list, those who manage applications get all of them.
describe('Answers of the application flag routes', () => {
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

        event = await generator.createEvent({ type: 'agora', applications: [] });
        // Somebody else's application; the core mock knows the notification email of user 2.
        application = await generator.createApplication({
            user_id: 2,
            status: 'accepted',
            confirmed: true,
            registered: true
        }, event);
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const setFlag = (route, body) => request({
        path: '/events/' + event.id + '/applications/' + application.id + '/' + route,
        method: 'PUT',
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const incomingFields = [...constants.ALLOWED_INCOMING_FIELDS, 'notification_email'];

    describe.each([
        ['incoming', 'global:manage_incoming:agora', '/incoming', incomingFields, [
            ['confirmed', { confirmed: true }],
            ['incoming', { incoming: true }],
            ['attended', { attended: true }]
        ]],
        ['juridical', 'global:manage_juridical:agora', '/juridical', constants.ALLOWED_JURIDICAL_LIST_FIELDS, [
            ['registered', { registered: true }],
            ['departed', { departed: true }]
        ]],
        ['network', 'global:update_memberslist_status:agora', '/network', constants.ALLOWED_NETWORK_LIST_FIELDS, [
            ['is_on_memberslist', { is_on_memberslist: true }]
        ]]
    ])('for the %s officer', (role, permission, listing, fields, flags) => {
        beforeEach(() => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });
        });

        test.each(flags)('should answer "%s" with the fields of the officer\'s list', async (route, body) => {
            const res = await setFlag(route, body);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.id).toEqual(application.id);
            expect(Object.keys(res.body.data).sort()).toEqual([...fields].sort());

            const applicationFromDb = await Application.findByPk(application.id);
            for (const [key, value] of Object.entries(body)) {
                expect(applicationFromDb[key]).toEqual(value);
            }
        });

        test('should answer with the same fields as the officer\'s list', async () => {
            const [route, body] = flags[0];
            const res = await setFlag(route, body);

            const list = await request({
                path: '/events/' + event.id + '/applications' + listing,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(list.statusCode).toEqual(200);
            expect(list.body.data.length).toEqual(1);
            expect(Object.keys(res.body.data).sort()).toEqual(Object.keys(list.body.data[0]).sort());
        });
    });

    test.each(['registered', 'departed', 'is_on_memberslist'])('should not answer "%s" with the passport data or the board comment', async (route) => {
        mock.mockAll({
            mainPermissions: { permissions: ['global:manage_juridical:agora', 'global:update_memberslist_status:agora'] }
        });

        const res = await setFlag(route, { [route]: true });

        expect(res.statusCode).toEqual(200);
        for (const field of ['visa_passport_number', 'date_of_birth', 'allergies', 'answers', 'board_comment', 'notification_email', 'nationality']) {
            expect(res.body.data).not.toHaveProperty(field);
        }
    });

    test.each([
        ['confirmed', { confirmed: true }],
        ['incoming', { incoming: true }],
        ['attended', { attended: true }],
        ['registered', { registered: true }],
        ['departed', { departed: true }],
        ['is_on_memberslist', { is_on_memberslist: true }],
        ['cancel', { cancelled: true }]
    ])('should answer "%s" with the whole application for those who manage applications', async (route, body) => {
        mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

        const res = await setFlag(route, body);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(application.id);
        for (const field of ['visa_passport_number', 'date_of_birth', 'allergies', 'answers', 'board_comment', 'nationality', 'gender']) {
            expect(res.body.data).toHaveProperty(field);
        }
    });
});
