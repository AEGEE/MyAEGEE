const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Positions listing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if not Agora', async () => {
        const event = await generator.createEvent({ type: 'epm', applications: [] });
        await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list all of the positions for this event', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPosition = await generator.createPosition({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({}, secondEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/positions/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstPosition.id);
    });

    test('should sort positions on /', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPosition = await generator.createPosition({}, firstEvent);
        const secondPosition = await generator.createPosition({}, firstEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/positions/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(firstPosition.id);
        expect(res.body.data[1].id).toEqual(secondPosition.id);
    });

    test('should list all of the approved candidates on /approved', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'approved' })]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(position.id);
        expect(res.body.data[0].candidates.length).toEqual(1);
        expect(res.body.data[0].candidates[0]).toHaveProperty('first_name');
        expect(res.body.data[0].candidates[0]).not.toHaveProperty('email');
        expect(res.body.data[0].candidates[0]).not.toHaveProperty('notification_email');
    });

    test('should indicate that there is unapproved application on /approved', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'pending' })]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(position.id);
        expect(res.body.data[0].candidates.length).toEqual(1);
        expect(res.body.data[0].candidates[0]).not.toHaveProperty('european_experience');
    });

    test('should not list rejected applications on /approved', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'rejected' })]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(0);
    });

    test('should sort positions on /all', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPosition = await generator.createPosition({}, firstEvent);
        const secondPosition = await generator.createPosition({}, firstEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(firstPosition.id);
        expect(res.body.data[1].id).toEqual(secondPosition.id);
    });

    test('should not list any deleted positions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            deleted: true
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list all applications on /all', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [
                generator.generateCandidate({ user_id: 1, status: 'rejected' }),
                generator.generateCandidate({ user_id: 2, status: 'approved' }),
                generator.generateCandidate({ user_id: 3, status: 'pending' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(3);
    });

    test('should return 403 if you don\'t have permissions on /all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [
                generator.generateCandidate({ user_id: 1, status: 'rejected' }),
                generator.generateCandidate({ user_id: 2, status: 'approved' }),
                generator.generateCandidate({ user_id: 3, status: 'pending' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should sort positions on /all', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPosition = await generator.createPosition({}, firstEvent);
        const secondPosition = await generator.createPosition({}, firstEvent);

        const res = await request({
            path: '/events/' + firstEvent.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(firstPosition.id);
        expect(res.body.data[1].id).toEqual(secondPosition.id);
    });

    test('should return my positions on /mine', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [
                generator.generateCandidate({ status: 'rejected', user_id: regularUser.bodies[0].id }),
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/candidates/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errorss');
    });

    test('should sort candidates on /all', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const firstCandidate = await generator.createCandidate({ user_id: 1 }, position);
        const secondCandidate = await generator.createCandidate({ user_id: 2 }, position);
        const thirdCandidate = await generator.createCandidate({ user_id: 3 }, position);

        const res = await request({
            path: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(3);
        expect(res.body.data[0].candidates[0].id).toEqual(firstCandidate.id);
        expect(res.body.data[0].candidates[1].id).toEqual(secondCandidate.id);
        expect(res.body.data[0].candidates[2].id).toEqual(thirdCandidate.id);
    });

    test('should sort candidates on /approved', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const firstCandidate = await generator.createCandidate({ user_id: 1, status: 'approved' }, position);
        const secondCandidate = await generator.createCandidate({ user_id: 2, status: 'approved' }, position);
        const thirdCandidate = await generator.createCandidate({ user_id: 3, status: 'approved' }, position);

        const res = await request({
            path: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(3);
        expect(res.body.data[0].candidates[0].id).toEqual(firstCandidate.id);
        expect(res.body.data[0].candidates[1].id).toEqual(secondCandidate.id);
        expect(res.body.data[0].candidates[2].id).toEqual(thirdCandidate.id);
    });

    test('should return only my candidatures of the event in the URL on /mine', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({ name: 'President' }, event);
        const deletedPosition = await generator.createPosition({ deleted: true }, event);
        const mine = await generator.createCandidate({ user_id: regularUser.id }, position);
        await generator.createCandidate({ user_id: regularUser.id }, deletedPosition);
        await generator.createCandidate({ user_id: 1337 }, position);

        // A candidature of the same member at another Agora.
        const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const otherPosition = await generator.createPosition({}, otherEvent);
        await generator.createCandidate({ user_id: regularUser.id }, otherPosition);

        const res = await request({
            path: '/events/' + event.id + '/positions/candidates/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((candidate) => candidate.id)).toEqual([mine.id]);
        expect(res.body.data[0].position.id).toEqual(position.id);
        expect(res.body.data[0].position.name).toEqual('President');
    });

    describe('who sees which candidatures', () => {
        const MANAGE = 'global:manage_candidates:agora';
        const PENDING_FIELDS = ['body_name', 'created_at', 'first_name', 'id', 'last_name', 'status'];

        const get = (event, route) => request({
            path: '/events/' + event.id + '/positions' + route,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // A position with one candidature of each status, of the users the mails mock knows.
        const createPositionWithCandidates = (event) => generator.createPosition({
            candidates: [
                generator.generateCandidate({ user_id: 2, status: 'approved', first_name: 'Approved' }),
                generator.generateCandidate({ user_id: 3, status: 'pending', first_name: 'Pending' }),
                generator.generateCandidate({ user_id: 4, status: 'rejected', first_name: 'Rejected' })
            ]
        }, event);

        test('shows a member without permissions the approved candidatures without mail addresses, the pending ones by name only and no rejected ones', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await createPositionWithCandidates(event);

            const res = await get(event, '/approved');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(position.id);

            const candidates = Object.fromEntries(res.body.data[0].candidates.map((candidate) => [candidate.first_name, candidate]));
            expect(Object.keys(candidates).sort()).toEqual(['Approved', 'Pending']);

            expect(candidates.Approved.status).toEqual('approved');
            expect(candidates.Approved).toHaveProperty('motivation');
            expect(candidates.Approved).toHaveProperty('date_of_birth');
            expect(candidates.Approved).not.toHaveProperty('email');
            expect(candidates.Approved).not.toHaveProperty('notification_email');

            expect(Object.keys(candidates.Pending).sort()).toEqual(PENDING_FIELDS);
            expect(candidates.Pending.status).toEqual('pending');
        });

        test('gives a holder of global:manage_candidates:agora no more than any member on /approved', async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await createPositionWithCandidates(event);

            const res = await get(event, '/approved');

            expect(res.statusCode).toEqual(200);
            const candidates = Object.fromEntries(res.body.data[0].candidates.map((candidate) => [candidate.first_name, candidate]));
            expect(Object.keys(candidates).sort()).toEqual(['Approved', 'Pending']);
            expect(candidates.Approved).not.toHaveProperty('notification_email');
            expect(Object.keys(candidates.Pending).sort()).toEqual(PENDING_FIELDS);
        });

        test('shows a holder of global:manage_candidates:agora alone every candidature on /all, with the address core has for the candidate', async () => {
            mock.mockAll({
                mainPermissions: { permissions: [MANAGE] },
                member: { user: { ...regularUser, notification_email: 'candidate@example.org' } }
            });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await createPositionWithCandidates(event);

            const res = await get(event, '/all');

            expect(res.statusCode).toEqual(200);
            const candidates = res.body.data[0].candidates
                .map((candidate) => [candidate.first_name, candidate.status, candidate.notification_email])
                .sort();
            expect(candidates)
                .toEqual([
                    ['Approved', 'approved', 'candidate@example.org'],
                    ['Pending', 'pending', 'candidate@example.org'],
                    ['Rejected', 'rejected', 'candidate@example.org']
                ]);
            expect(res.body.data[0].candidates[0]).toHaveProperty('motivation');
        });

        test('refuses /all to a holder of the permission for another event type and of the other permissions for an Agora', async () => {
            mock.mockAll({
                mainPermissions: {
                    permissions: [
                        'global:manage_candidates:epm',
                        'global:manage_event:agora',
                        'global:manage_applications:agora',
                        'global:manage_plenaries:agora',
                        'global:manage_question_lines:agora'
                    ]
                }
            });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await createPositionWithCandidates(event);

            const res = await get(event, '/all');

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage positions.' });
        });

        test.each([['/all'], ['/approved']])('lists on %s only the positions of this Agora that are not deleted', async (route) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await createPositionWithCandidates(event);
            await generator.createPosition({ deleted: true, candidates: [generator.generateCandidate({ status: 'approved' })] }, event);

            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await createPositionWithCandidates(otherEvent);

            const res = await get(event, route);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((p) => p.id)).toEqual([position.id]);
        });

        describe.each([['/all'], ['/approved']])('on %s when core fails', (route) => {
            test.each([
                ['is not reachable for the login of the service', { login: { netError: true } }],
                ['refuses the login of the service', { login: { unsuccessfulResponse: true } }],
                ['is not reachable for the candidate', { member: { netError: true } }],
                ['does not give the candidate', { member: { unsuccessfulResponse: true } }]
            ])('answers 500 when core %s', async (description, coreMocks) => {
                mock.mockAll(coreMocks);
                const event = await generator.createEvent({ type: 'agora', applications: [] });
                await createPositionWithCandidates(event);

                const res = await get(event, route);

                expect(res.statusCode).toEqual(500);
                expect(res.body.success).toEqual(false);
                expect(res.body).not.toHaveProperty('data');
            });

            test('answers 200 when no position has a candidature, as core is not asked then', async () => {
                mock.mockAll({ login: { netError: true }, member: { netError: true } });
                const event = await generator.createEvent({ type: 'agora', applications: [] });
                const position = await generator.createPosition({}, event);

                const res = await get(event, route);

                expect(res.statusCode).toEqual(200);
                expect(res.body.data.map((p) => [p.id, p.candidates])).toEqual([[position.id, []]]);
            });
        });
    });

    describe('can_apply at the edges of the period of a position', () => {
        const STARTS = new Date('2031-06-01T10:00:00.000Z');
        const ENDS = new Date('2031-06-15T10:00:00.000Z');

        afterEach(() => {
            tk.reset();
        });

        test.each([
            ['false 1 ms before the period starts', new Date(STARTS.getTime() - 1), false],
            ['true exactly when the period starts (inclusive)', STARTS, true],
            ['true exactly when the period ends (inclusive)', ENDS, true],
            ['false 1 ms after the period ends', new Date(ENDS.getTime() + 1), false]
        ])('is %s', async (description, now, canApply) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createPosition({ starts: STARTS, ends: ENDS }, event);

            tk.freeze(now);
            const res = await request({
                path: '/events/' + event.id + '/positions/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((position) => position.can_apply)).toEqual([canApply]);
        });
    });

    describe.each(['epm', 'spm'])('of an %s event', (type) => {
        test.each([
            ['/export'],
            ['/all'],
            ['/approved'],
            ['/candidates/mine']
        ])('answers 400 on /positions%s', async (route) => {
            // Every permission there is, for this type too.
            mock.mockAll({
                mainPermissions: { permissions: ['global:manage_candidates:agora', `global:manage_candidates:${type}`] }
            });
            const event = await generator.createEvent({ type, applications: [] });
            await generator.createPosition({ candidates: [generator.generateCandidate({ user_id: regularUser.id })] }, event);

            const res = await request({
                path: '/events/' + event.id + '/positions' + route,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
        });
    });
});
