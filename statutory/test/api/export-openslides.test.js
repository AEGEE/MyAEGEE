const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Export OpenSlides', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({ applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return nothing if no applications', async () => {
        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(1);
    });

    test('should return nothing if only cancelled or not accepted applications', async () => {
        await generator.createApplication({ cancelled: true, status: 'accepted', user_id: 1 }, event);
        await generator.createApplication({ cancelled: false, status: 'rejected', user_id: 2 }, event);
        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(1);
    });

    test('should return the application if there are not cancelled and accepted application', async () => {
        await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const body = res.body.split('\n').filter((l) => l.length > 0);
        expect(body.length).toEqual(2);
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
    });

    test('should escape quotes in the values and keep one line per participant', async () => {
        await generator.createApplication({
            user_id: regularUser.id,
            status: 'accepted',
            first_name: 'Anna "Annie"',
            last_name: 'Smith, Jr.',
            body_name: 'AEGEE-"Test"'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const lines = res.body.split('\n').filter((l) => l.length > 0);
        expect(lines.length).toEqual(2);
        // A quote inside a value is doubled, so the value stays one CSV field.
        expect(lines[1]).toContain('"Anna ""Annie""","Smith, Jr."');
        expect(lines[1]).toContain('(AEGEE-""Test"").');
    });

    test('should export one line per participant with the columns OpenSlides imports', async () => {
        const application = await generator.createApplication({
            user_id: 2,
            status: 'accepted',
            first_name: 'Anna',
            last_name: 'Applicant',
            body_id: 1337,
            body_name: 'AEGEE-Test',
            participant_type: 'delegate',
            participant_order: 1
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/export/openslides',
            method: 'GET',
            responseType: 'text',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toMatch(/^text\/csv/);
        expect(res.headers['content-disposition']).toEqual('attachment; filename=openslides.csv');

        const [header, line] = res.body.split('\n');
        expect(header).toEqual([
            'Title',
            'Given name',
            'Surname',
            'Structure level',
            'Participant number',
            'Groups',
            'Comment',
            'Is active',
            'Is present',
            'Is committee',
            'Initial password',
            'Email'
        ].map((column) => `"${column}"`).join(','));

        const fields = line.slice(1, -1).split('","');
        expect(fields.length).toEqual(12);

        // A new password of ten hexadecimal characters on every export.
        const password = fields[10];
        expect(password).toMatch(/^[0-9a-f]{10}$/);

        expect(fields).toEqual([
            '',
            'Anna',
            'Applicant',
            '',
            String(application.id),
            'delegate',
            'Body ID: 1337 (AEGEE-Test). User ID: 2',
            '1',
            '1',
            '0',
            password,
            'test@example.com'
        ]);
    });

    describe('who may export', () => {
        test.each([
            ['global:manage_incoming:agora', 200],
            ['global:manage_applications:agora', 200],
            ['global:manage_juridical:agora', 403],
            ['global:update_memberslist_status:agora', 403],
            ['global:approve_members:agora', 403],
            ['global:manage_incoming:epm', 403],
            ['global:manage_applications:epm', 403]
        ])('%s alone answers %i on an Agora', async (permission, status) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const agora = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ user_id: 2, status: 'accepted', first_name: 'Anna' }, agora);

            const res = await request({
                path: '/events/' + agora.id + '/applications/export/openslides',
                method: 'GET',
                responseType: 'text',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(status);

            if (status === 200) {
                expect(res.headers['content-type']).toMatch(/^text\/csv/);
                expect(res.body.split('\n').length).toEqual(2);
            } else {
                // No participant in the refusal.
                expect(JSON.parse(res.body).success).toEqual(false);
                expect(res.body).not.toContain('Anna');
            }
        });
    });
});
