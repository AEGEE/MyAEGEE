const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { at, fixedDates, BEFORE_EVERYTHING } = require('../scripts/fixed-event');
const regularUser = require('../assets/core-valid.json').data;

describe('Events participating', () => {
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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should not display events you haven\'t applied to', async () => {
        const event = await generator.createEvent({ status: 'published' });

        const res = await request({
            path: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map((e) => e.id);
        expect(ids).not.toContain(event.id);
    });

    test('should display all published events you applied to', async () => {
        const event = await generator.createEvent({ status: 'published' });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            path: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map((e) => e.id);
        expect(ids).toContain(event.id);
    });

    test('should hide application status on /mine until it is revealed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published'
        });

        await generator.createApplication({
            user_id: regularUser.id,
            status: 'accepted'
        }, event);

        const hiddenRes = await request({
            path: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(hiddenRes.statusCode).toEqual(200);
        expect(hiddenRes.body.data[0].applications[0].status).toEqual('pending');

        await event.update({ application_status_revealed_at: new Date() });

        const revealedRes = await request({
            path: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(revealedRes.statusCode).toEqual(200);
        expect(revealedRes.body.data[0].applications[0].status).toEqual('accepted');
    });

    const mine = async () => {
        const res = await request({
            path: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        return res.body.data;
    };

    describe('what is listed', () => {
        test('should give an empty list to a member who never applied', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1337 }, event);

            expect(await mine()).toEqual([]);
        });

        test('should list the event with the application of the caller only', async () => {
            const event = await generator.createEvent({ type: 'agora' });
            await generator.createApplication({ user_id: 1337, status: 'rejected' }, event);
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
            await generator.createApplication({ user_id: 1338, cancelled: true }, event);

            const events = await mine();

            expect(events.length).toEqual(1);
            expect(events[0].id).toEqual(event.id);
            expect(events[0].name).toEqual(event.name);
            // The caller manages the applications of an Agora in the default mock, so the status shows.
            expect(events[0].applications).toEqual([{ user_id: regularUser.id, cancelled: false, status: 'accepted' }]);
        });

        test('should list an event the caller cancelled their application to, and say so', async () => {
            const event = await generator.createEvent({ type: 'agora' });
            await generator.createApplication({ user_id: regularUser.id, cancelled: true, status: 'pending' }, event);

            const events = await mine();

            expect(events.map((e) => e.id)).toEqual([event.id]);
            expect(events[0].applications).toEqual([{ user_id: regularUser.id, cancelled: true, status: 'pending' }]);
        });

        test('should list the event that starts first on top', async () => {
            const last = await generator.createEvent(fixedDates({ starts: at('starts', 86400000), ends: at('ends', 86400000) }));
            const first = await generator.createEvent(fixedDates());
            const notApplied = await generator.createEvent(fixedDates({ starts: at('starts', -86400000) }));
            for (const event of [last, first]) {
                await generator.createApplication({ user_id: regularUser.id }, event);
            }
            await generator.createApplication({ user_id: 1337 }, notApplied);

            expect((await mine()).map((e) => e.id)).toEqual([first.id, last.id]);
        });

        test('should answer a member without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: regularUser.id }, event);

            expect((await mine()).map((e) => e.id)).toEqual([event.id]);
        });
    });

    // The applicant reads "pending" until the participants list deadline, whatever the
    // organisers decided, unless the event revealed the statuses earlier.
    describe('the status of the application', () => {
        let event;

        const statusOf = async () => (await mine())[0].applications[0].status;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', ...fixedDates() });
            mock.mockAll({ mainPermissions: { noPermissions: true } });
        });

        test.each(['accepted', 'rejected', 'waiting_list'])('should read "pending" for an application that is %s 1 ms before the participants list deadline', async (status) => {
            await generator.createApplication({ user_id: regularUser.id, status }, event);
            tk.freeze(at('participants_list_publish_deadline', -1));

            expect(await statusOf()).toEqual('pending');
        });

        test.each([
            ['exactly at the participants list deadline (inclusive)', 0],
            ['1 ms after the participants list deadline', 1]
        ])('should show %s', async (description, offset) => {
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
            tk.freeze(at('participants_list_publish_deadline', offset));

            expect(await statusOf()).toEqual('accepted');
        });

        test('should show before the deadline to those who manage the applications of events of this type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });
            await generator.createApplication({ user_id: regularUser.id, status: 'rejected' }, event);
            tk.freeze(BEFORE_EVERYTHING);

            expect(await statusOf()).toEqual('rejected');
        });

        test('should read "pending" before the deadline to those who manage the applications of another type, or this event', async () => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:manage_applications:epm', 'global:manage_event:agora', 'global:manage_incoming:agora'] }
            });
            await generator.createApplication({ user_id: regularUser.id, status: 'rejected' }, event);
            tk.freeze(BEFORE_EVERYTHING);

            expect(await statusOf()).toEqual('pending');
        });

        test('should hide the status per event', async () => {
            const revealed = await generator.createEvent({
                type: 'epm',
                application_status_revealed_at: BEFORE_EVERYTHING,
                ...fixedDates({ starts: at('starts', 86400000), ends: at('ends', 86400000) })
            });
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);
            await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, revealed);
            tk.freeze(BEFORE_EVERYTHING);

            const events = await mine();

            expect(events.map((e) => [e.id, e.applications[0].status])).toEqual([
                [event.id, 'pending'],
                [revealed.id, 'accepted']
            ]);
        });
    });
});
