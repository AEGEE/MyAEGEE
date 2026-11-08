const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const coOrganizingBody = require('../assets/oms-core-body.json').data;

describe('Events editing', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }] });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow event editing if the user doesn\'t have rights to do it', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const notMineEvent = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: 333 }] });

        const res = await request({
            path: '/single/' + notMineEvent.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should update an event on a sane /single/<eventid> PUT', async () => {
        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        expect(res.statusCode).toEqual(200);
    });

    it('should update the organizers if requested', async () => {
        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                organizers: [{ user_id: 1337 }],
            }
        });

        expect(res.statusCode).toEqual(200);
    });

    it('should store the changes on update after a sane /single/<eventid> PUT', async () => {
        await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
            }
        });

        const res = await request({
            path: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.body.data.description).toEqual('some new description');
    });

    it('should ignore superflous fields on overly detailed /single/<eventid> PUT', async () => {
        await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'published',
            }
        });

        const res = await request({
            path: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).not.toEqual('published');
    });

    it('should return a validation error on malformed /single/<eventid> PUT', async () => {
        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                ends: 'sometime',
            }
        });

        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    it('should fail if no organizers are set', async () => {
        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                organizers: []
            }
        });

        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('organizers');
    });

    it('should disallow event deleting if the user doesn\'t have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/single/' + event.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should hide an event from / GET but keep it for /single GET after /single DELETE', async () => {
        const deleteRequest = await request({
            path: '/single/' + event.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(deleteRequest.statusCode).toEqual(200);

        const res = await request({
            path: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // Delete one event.
        expect(res.statusCode).toEqual(200);

        expect(res.body.data.id).toEqual(event.id);
        expect(res.body.data.deleted).toEqual(true);
    });

    it('should update the bodies if provided', async () => {
        event = await generator.createEvent({
            organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }],
            organizing_bodies: [{ body_id: user.bodies[0].id, body_name: 'test' }]
        });

        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                organizing_bodies: [{ body_id: user.bodies[0].id }]
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.organizing_bodies[0].body_name).toEqual(user.bodies[0].name);
    });

    it('should not change the European Event status on normal edit request', async () => {
        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                description: 'some new description',
                is_european_event: false
            }
        });

        expect(res.statusCode).toEqual(200);

        const response = await request({
            path: '/single/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data.is_european_event).toEqual(true);
    });

    describe('organizers outside the organizing bodies', () => {
        let cultural;

        beforeEach(async () => {
            cultural = await generator.createEvent({
                type: 'cultural',
                organizing_bodies: [{ body_id: 555, body_name: 'Organizing body' }],
                organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }]
            });
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event'] },
                member: { bodies: [{ id: 999, name: 'Other body' }] }
            });
        });

        it('should keep existing organizers even if they are not in an organizing body', async () => {
            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { organizers: [{ user_id: user.id }] }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizers.map((organizer) => organizer.user_id)).toEqual([user.id]);
        });

        it('should reject new organizers who are not in an organizing body', async () => {
            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { organizers: [{ user_id: user.id }, { user_id: 4242 }] }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('organizers');
        });

        it('should not let managers of another type bypass the rule by changing the type', async () => {
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event', 'global:manage_event:nwm'] },
                member: { bodies: [{ id: 999, name: 'Other body' }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { type: 'nwm', organizers: [{ user_id: user.id }, { user_id: 4242 }] }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('organizers');
        });

        it('should let managers of both types add anyone when changing the type', async () => {
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event', 'global:manage_event:nwm', 'global:manage_event:cultural'] },
                member: { bodies: [{ id: 999, name: 'Other body' }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { type: 'nwm', organizers: [{ user_id: user.id }, { user_id: 4242 }] }
            });

            expect(res.statusCode).toEqual(200);
        });

        it('should accept organizers from an organizing body added in the same request', async () => {
            // The mocked core body is always the same body.
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event'] },
                member: { bodies: [{ id: coOrganizingBody.id, name: coOrganizingBody.name }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {
                    organizing_bodies: [{ body_id: coOrganizingBody.id }],
                    organizers: [{ user_id: user.id }, { user_id: 4242 }]
                }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizers.map((organizer) => organizer.user_id)).toEqual([user.id, 4242]);
        });

        it('should accept new organizers who are in an organizing body', async () => {
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event'] },
                member: { bodies: [{ id: 555, name: 'Organizing body' }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { organizers: [{ user_id: user.id }, { user_id: 4242 }] }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizers.map((organizer) => organizer.user_id)).toEqual([user.id, 4242]);
        });
    });
});
