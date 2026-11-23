const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;
const callers = require('../scripts/callers');
const { Event } = require('../../models');

describe('Events set European Event', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({
            organizers: [
                { first_name: 'test', last_name: 'test', user_id: user.id },
            ],
        });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    const putEuropean = (id, body) => request({
        path: '/single/' + id + '/status/european_event',
        headers: { 'X-Auth-Token': 'foobar' },
        method: 'PUT',
        body
    });

    it('should mail the organizers when an event becomes European', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);
        const national = await generator.createEvent({ is_european_event: false });

        const res = await putEuropean(national.id, { is_european_event: true });

        expect(res.statusCode).toEqual(200);
        expect(mails).toHaveLength(1);
        expect(mails[0].template).toEqual('events_european_status_changed.html');
        expect(mails[0].to).toEqual([user.notification_email]);
    });

    it('should not mail the organizers when an event stops being European', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);

        const res = await putEuropean(event.id, { is_european_event: false });

        expect(res.statusCode).toEqual(200);
        expect(mails).toEqual([]);
    });

    it('should not mail the organizers when the event was European already', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);

        const res = await putEuropean(event.id, { is_european_event: true });

        expect(res.statusCode).toEqual(200);
        expect(mails).toEqual([]);
    });

    it('should change nothing and send no mail for a body without is_european_event', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);

        const res = await putEuropean(event.id, {});

        expect(res.statusCode).toEqual(200);
        expect(mails).toEqual([]);
        expect((await Event.findByPk(event.id)).is_european_event).toEqual(true);
    });

    it('should not let a manager without the European status permission change it', async () => {
        callers.asMember([`global:manage_event:${event.type}`]);

        const res = await putEuropean(event.id, { is_european_event: false });

        expect(res.statusCode).toEqual(403);
        expect((await Event.findByPk(event.id)).is_european_event).toEqual(true);
    });

    it('should let a member with the European status permission of the type change it', async () => {
        callers.asMember([`global:change_european_event_status:${event.type}`]);

        const res = await putEuropean(event.id, { is_european_event: false });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(event.id)).is_european_event).toEqual(false);
    });

    it('should fail setting European Event status if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: true,
            },
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return a validation error on malformed body for changing European Event status', async () => {
        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: 'blablabla',
            },
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('is_european_event');
    });

    it('should succeed changing European Event status on sane request', async () => {
        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: false,
            },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual(
            'Successfully changed European Event status'
        );
    });

    it('should succeed changing European Event status back to true', async () => {
        const europeanEvent = await generator.createEvent({
            is_european_event: false,
        });

        const res = await request({
            path: '/single/' + europeanEvent.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: true,
            },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual(
            'Successfully changed European Event status'
        );
    });
});
