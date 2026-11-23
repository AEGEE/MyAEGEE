const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Position } = require('../../models');

describe('Positions edition', () => {
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

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: 3 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if position is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await request({
            path: '/events/' + event.id + '/positions/1337',
            method: 'PUT',
            body: { places: 3 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if positions ID is NaN', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/NaN',
            method: 'PUT',
            body: { places: 3 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything\'s okay', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: 3 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.places).toEqual(3);
    });

    test('should fail on validation errors', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: { places: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('places');
    });

    test('should remove extra fields', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate() // status = open
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id,
            method: 'PUT',
            body: {
                id: position.id + 1,
                status: 'closed'
            },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.id).toEqual(position.id);
        expect(res.body.data.status).toEqual('open');
    });

    describe('who may edit a position and what it takes', () => {
        const MANAGE = 'global:manage_candidates:agora';
        let event;
        let position;

        beforeEach(async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            position = await generator.createPosition({
                name: 'President',
                places: 2,
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate() // status = open
            }, event);
        });

        const edit = (body, targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const stored = () => Position.findByPk(position.id);

        test('lets a holder of global:manage_candidates:agora alone edit a position', async () => {
            const res = await edit({ name: 'Secretary General', places: 1, requirements: 'Some experience' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: position.id, name: 'Secretary General', places: 1, requirements: 'Some experience' });
            expect(await stored()).toMatchObject({ name: 'Secretary General', places: 1, requirements: 'Some experience' });
        });

        test('refuses the permission for another event type and the other permissions for an Agora', async () => {
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

            const res = await edit({ name: 'Secretary General' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot manage positions.' });
            expect((await stored()).name).toEqual('President');
        });

        test('keeps the position in its event whatever event the body names', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await edit({ name: 'Secretary General', event_id: otherEvent.id });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.event_id).toEqual(event.id);
            expect((await stored()).event_id).toEqual(event.id);
        });

        test.each([
            ['an empty name', { name: '' }, 'name'],
            ['0 places', { places: 0 }, 'places'],
            ['a start of the term that is not a date', { start_term: '2031-13-45' }, 'start_term'],
            ['an empty end of the term', { end_term: '' }, 'end_term'],
            ['a start of the period that is not a date', { starts: '2031-13-45T10:00:00.000Z' }, 'starts'],
            ['an end of the period before its start', { ends: moment().subtract(2, 'weeks').toDate() }, 'ends']
        ])('answers 422 for %s and changes nothing', async (description, change, field) => {
            const before = (await stored()).toJSON();

            const res = await edit({ name: 'Secretary General', ...change });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect((await stored()).toJSON()).toEqual(before);
        });

        // BUG: the rule that a period ends after it starts is only checked when the end is sent,
        // so moving the start past the end is accepted. Expected: 422 with errors.starts or errors.ends.
        test('accepts a start of the period after its end when the end is not sent', async () => {
            const res = await edit({ starts: moment().add(2, 'weeks').toDate() });

            expect(res.statusCode).toEqual(200);

            const fromDb = await stored();
            expect(moment(fromDb.starts).isAfter(fromDb.ends)).toEqual(true);
        });

        // BUG: the status follows the period only when a position is added. An edit of the period
        // cancels the jobs that open and close the position and plans none for a moment that has
        // passed, so the position keeps its status. Expected: closed, as its period is over.
        test('leaves a position open when its period is moved to the past', async () => {
            const res = await edit({
                starts: moment().subtract(2, 'weeks').toDate(),
                ends: moment().subtract(1, 'week').toDate()
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.can_apply).toEqual(false);
            expect(res.body.data.status).toEqual('open');
            expect((await stored()).status).toEqual('open');
        });

        // BUG: the same for a position that is not open yet. Expected: open, as its period runs.
        test('leaves a position closed when its period is moved to include now', async () => {
            const closedPosition = await generator.createPosition({
                starts: moment().add(1, 'week').toDate(),
                ends: moment().add(2, 'weeks').toDate() // status = closed
            }, event);

            const res = await edit({ starts: moment().subtract(1, 'week').toDate() }, event, closedPosition);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.can_apply).toEqual(true);
            expect(res.body.data.status).toEqual('closed');
            expect((await Position.findByPk(closedPosition.id)).status).toEqual('closed');
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and changes nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({ name: 'President' }, otherEvent);

            const res = await edit({ name: 'Secretary General' }, otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect((await Position.findByPk(otherPosition.id)).name).toEqual('President');
        });
    });
});
