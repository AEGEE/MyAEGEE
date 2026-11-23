const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;
const coOrganizingBody = require('../assets/oms-core-body.json').data;
const callers = require('../scripts/callers');

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

    const putEvent = (id, body) => request({ path: '/single/' + id, headers: { 'X-Auth-Token': 'foobar' }, method: 'PUT', body });

    test.each(['submitted', 'published'])('should not let an organizer without permissions edit a %s event', async (status) => {
        callers.asMember();
        const own = await generator.createEvent({ status, organizers: [callers.organizer(callers.member)] });

        const res = await putEvent(own.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(403);
        expect((await Event.findByPk(own.id)).description).toEqual(own.description);
    });

    it('should let an organizer without permissions edit a draft', async () => {
        callers.asMember();
        const own = await generator.createEvent({ status: 'draft', organizers: [callers.organizer(callers.member)] });

        const res = await putEvent(own.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.description).toEqual('Changed');
    });

    it('should let a manager of the type edit a published event', async () => {
        callers.asMember(['global:manage_event:nwm']);
        const published = await generator.createEvent({ status: 'published', type: 'nwm' });

        const res = await putEvent(published.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.description).toEqual('Changed');
    });

    it('should still let a manager edit a deleted event', async () => {
        const deleted = await generator.createEvent({ deleted: true });

        const res = await putEvent(deleted.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(200);
    });

    it('should return 422 with a message if no field can be changed', async () => {
        const res = await putEvent(event.id, { status: 'published', deleted: true });

        expect(res.statusCode).toEqual(422);
        expect(res.body.message).toEqual('No valid field changes requested');
        expect((await Event.findByPk(event.id)).status).toEqual('draft');
    });

    it('should return 422 if the URL belongs to another event', async () => {
        await generator.createEvent({ url: 'taken' });

        const res = await putEvent(event.id, { url: 'taken' });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('url');
    });

    it('should not change the event if the mail cannot be sent', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const res = await putEvent(event.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(500);
        expect((await Event.findByPk(event.id)).description).toEqual(event.description);
    });

    it('should mail the organizers about the change', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);

        const res = await putEvent(event.id, { description: 'Changed' });

        expect(res.statusCode).toEqual(200);
        expect(mails).toHaveLength(1);
        expect(mails[0].template).toEqual('events_event_updated.html');
        expect(mails[0].to).toEqual([user.notification_email]);
        expect(mails[0].parameters.event.description).toEqual('Changed');
    });

    it('should not let an organizer without permissions delete their draft', async () => {
        callers.asMember();
        const own = await generator.createEvent({ status: 'draft', organizers: [callers.organizer(callers.member)] });

        const res = await request({ path: '/single/' + own.id, headers: { 'X-Auth-Token': 'foobar' }, method: 'DELETE' });

        expect(res.statusCode).toEqual(403);
        expect((await Event.findByPk(own.id)).deleted).toEqual(false);
    });

    it('should let a manager of the type delete an event, without a mail', async () => {
        const mails = mock.captureMails(callers.asMember(['global:manage_event:nwm']).omsMailerStub);
        const nwm = await generator.createEvent({ type: 'nwm', status: 'published' });

        const res = await request({ path: '/single/' + nwm.id, headers: { 'X-Auth-Token': 'foobar' }, method: 'DELETE' });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(nwm.id)).deleted).toEqual(true);
        expect(mails).toEqual([]);
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
        const putRes = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                status: 'published',
            }
        });

        // Nothing but ignored fields is left, so there is nothing to change.
        expect(putRes.statusCode).toEqual(422);
        expect(putRes.body.message).toEqual('No valid field changes requested');

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

        expect(res.statusCode).toEqual(422);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    it.each([
        ['type', 'training'],
        ['method', 'online']
    ])('should answer 422 for a %s that is not a string', async (field, value) => {
        const stored = event.toJSON()[field];

        for (const sent of [[value], { [field]: value }, 1]) {
            const res = await request({
                path: '/single/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { [field]: sent }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
        }
        await event.reload();
        expect(event[field]).toEqual(stored);
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

        expect(res.statusCode).toEqual(422);
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

    test.each(['notFound', 'forbidden'])('should return 422 if a new organizing body cannot be fetched (%s)', async (failure) => {
        mock.mockAll({ body: { [failure]: true } });

        const res = await request({
            path: '/single/' + event.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { organizing_bodies: [{ body_id: 4242 }] }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('organizing_bodies');
        expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        const fromDb = await Event.findByPk(event.id);
        expect(fromDb.organizing_bodies).toEqual(event.organizing_bodies);
    });

    describe('dates on partial edits', () => {
        const DAY = 24 * 60 * 60 * 1000;
        const inDays = (days) => new Date(Date.now() + days * DAY);
        let dated;

        beforeEach(async () => {
            dated = await generator.createEvent({
                organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }],
                application_starts: inDays(1),
                application_ends: inDays(10),
                starts: inDays(20),
                ends: inDays(30)
            });
        });

        const edit = (body) => request({
            path: '/single/' + dated.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        test.each([
            ['starts before the application period ends', { starts: inDays(5) }, 'application_ends'],
            ['starts after the event ends', { starts: inDays(40) }, 'ends'],
            ['ends before the event starts', { ends: inDays(15) }, 'ends'],
            ['application_starts after the application period ends', { application_starts: inDays(12) }, 'application_ends'],
            ['application_ends after the event starts', { application_ends: inDays(25) }, 'application_ends']
        ])('should return 422 if only %s is changed', async (name, body, field) => {
            const res = await edit(body);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty(field);

            const fromDb = await Event.findByPk(dated.id);
            expect(fromDb.starts).toEqual(dated.starts);
            expect(fromDb.ends).toEqual(dated.ends);
            expect(fromDb.application_starts).toEqual(dated.application_starts);
        });

        test('should accept a partial edit that keeps the dates in order', async () => {
            const starts = inDays(15);
            const res = await edit({ starts });

            expect(res.statusCode).toEqual(200);
            const fromDb = await Event.findByPk(dated.id);
            expect(fromDb.starts.getTime()).toEqual(starts.getTime());
        });
    });

    // The edit form sets the application period of an event without applications to "now" until
    // one minute before the start on every save. Once the event has started, that period ends
    // before it starts; it means nothing for such an event, so the checks of the application
    // dates do not apply to it.
    describe('events without applications', () => {
        const DAY = 24 * 60 * 60 * 1000;
        const MINUTE = 60 * 1000;
        const inDays = (days) => new Date(Date.now() + days * DAY);

        // An online event without applications, last saved three days before `startsIn` from now.
        const createWithoutApplications = (startsIn, endsIn) => {
            const starts = inDays(startsIn);
            return generator.createEvent({
                organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }],
                method: 'online',
                has_applications: false,
                application_starts: new Date(starts.getTime() - 3 * DAY),
                application_ends: new Date(starts.getTime() - MINUTE),
                starts,
                ends: inDays(endsIn)
            });
        };

        const get = (id) => request({ path: '/single/' + id, method: 'GET', headers: { 'X-Auth-Token': 'blablabla' } });
        const edit = (id, body) => request({ path: '/single/' + id, method: 'PUT', headers: { 'X-Auth-Token': 'blablabla' }, body });

        // What the edit form sends: the event as loaded, the bodies and organizers by id, and the
        // application period rewritten for an event without applications.
        const formPayload = (loaded, changes) => {
            const form = { ...loaded, ...changes };
            form.organizing_bodies = form.organizing_bodies.map((body) => ({ body_id: body.body_id }));
            form.organizers = form.organizers.map((organizer) => ({ user_id: organizer.user_id }));
            if (!form.has_applications) {
                form.application_starts = new Date().toISOString();
                form.application_ends = new Date(form.starts).getTime() - MINUTE;
            }
            return form;
        };

        test.each([
            ['started yesterday', -1, 2],
            ['ended yesterday', -3, -1]
        ])('should save an event without applications that %s with the form\'s payload', async (_name, startsIn, endsIn) => {
            const running = await createWithoutApplications(startsIn, endsIn);
            const loaded = await get(running.id);

            const res = await edit(running.id, formPayload(loaded.body.data, { description: 'A report of the event' }));

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(running.id)).description).toEqual('A report of the event');
        });

        test('should still check that an event without applications ends after it starts', async () => {
            const running = await createWithoutApplications(-1, 2);
            const loaded = await get(running.id);

            const res = await edit(running.id, formPayload(loaded.body.data, { ends: inDays(-2).toISOString() }));

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors)).toEqual(['ends']);
        });

        test('should check the application dates again when such an event takes applications', async () => {
            const running = await createWithoutApplications(-1, 2);
            // As a save from the form after the start leaves it: the period ends before it starts.
            await running.update({ application_starts: new Date() }, { validate: false });

            const res = await edit(running.id, { has_applications: true });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('application_ends');
            expect((await Event.findByPk(running.id)).has_applications).toEqual(false);
        });

        test('should check the application dates of a started event with applications as before', async () => {
            const running = await generator.createEvent({
                organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }],
                application_starts: inDays(-10),
                application_ends: inDays(-5),
                starts: inDays(-1),
                ends: inDays(2)
            });

            const res = await edit(running.id, { application_starts: new Date().toISOString() });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('application_ends');
        });

        test('should not show an event without applications as open for applications', async () => {
            const future = await createWithoutApplications(10, 12);
            await future.update({ application_starts: inDays(-1), status: 'published' });

            const res = await get(future.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status).toEqual('closed');
            expect(res.body.permissions.apply).toEqual(false);
        });
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
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
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
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
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

        it('should not let organizers replace the organizing bodies with bodies none of them is in', async () => {
            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {
                    organizing_bodies: [{ body_id: coOrganizingBody.id }],
                    organizers: [{ user_id: user.id }]
                }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty('organizers');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));

            await cultural.reload();
            expect(cultural.organizing_bodies.map((body) => body.body_id)).toEqual([555]);
        });

        it('should check the organizing bodies also when the organizers are not sent', async () => {
            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { organizing_bodies: [{ body_id: coOrganizingBody.id }] }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('organizers');
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));

            await cultural.reload();
            expect(cultural.organizing_bodies.map((body) => body.body_id)).toEqual([555]);
        });

        it('should let managers of the type change the organizing bodies freely', async () => {
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event', 'global:manage_event:cultural'] },
                member: { bodies: [{ id: 999, name: 'Other body' }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {
                    organizing_bodies: [{ body_id: coOrganizingBody.id }],
                    organizers: [{ user_id: user.id }]
                }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizing_bodies.map((body) => body.body_id)).toEqual([coOrganizingBody.id]);
        });

        it('should let organizers change the organizing bodies if one of them is in a new one', async () => {
            mock.mockAll({
                mainPermissions: { combined: ['global:create:event'] },
                member: { bodies: [{ id: coOrganizingBody.id, name: coOrganizingBody.name }] }
            });

            const res = await request({
                path: '/single/' + cultural.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { organizing_bodies: [{ body_id: coOrganizingBody.id }] }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizing_bodies.map((body) => body.body_id)).toEqual([coOrganizingBody.id]);
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

    describe('links', () => {
        const fields = ['budget', 'programme', 'link_info_travel_country'];

        test.each(fields.flatMap((field) => [
            // eslint-disable-next-line no-script-url
            [field, 'javascript:alert(1)'],
            [field, ' JavaScript:alert(1)'],
            [field, 'data:text/html,<script>alert(1)</script>'],
            [field, 'vbscript:msgbox(1)'],
            [field, 'https://exa mple.org'],
            // Browsers drop tabs and newlines, so these would open as javascript: links.
            [field, 'java\tscript://%0aalert(1)'],
            [field, 'java\nscript://%0aalert(1)'],
            [field, 'data\t://text/html,x'],
            [field, 'www.aegee.org/travel']
        ]))('should reject %s %j', async (field, link) => {
            const res = await request({
                path: '/single/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { [field]: link }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb[field]).toEqual(event[field]);
        });

        test.each(fields.flatMap((field) => [
            [field, 'https://docs.google.com/spreadsheets/d/abc'],
            [field, 'http://www.aegee.org'],
            [field, ''],
            [field, null]
        ]))('should accept %s %j', async (field, link) => {
            const res = await request({
                path: '/single/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { [field]: link }
            });

            expect(res.statusCode).toEqual(200);

            const eventFromDb = await Event.findByPk(event.id);
            expect(eventFromDb[field]).toEqual(link);
        });

        it('should reject a link that is not a string', async () => {
            const res = await request({
                path: '/single/' + event.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { budget: ['https://www.aegee.org'] }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('budget');
        });
    });
});
