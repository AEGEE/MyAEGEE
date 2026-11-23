const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

// Organizers have to be members of one of the organizing or cooperation bodies, unless the
// user can manage Summer Universities of that type. The generated events are organized by
// body 34; user #1 (the logged-in user) is a member of it. The core mocks reply with the
// requested body and with per-user bodies, so the organizers can be in different bodies.
const ORGANIZING_BODY = 34;
const COOPERATION_BODY = 77;
const OUTSIDER = 1003;

// User #1 can create Summer Universities, but not manage them.
const creatorMocks = (bodiesById) => ({
    mainPermissions: { permissions: ['global:create:summeruniversity'] },
    member: { bodiesById: { [user.id]: [ORGANIZING_BODY], ...bodiesById } },
    body: { echoId: true }
});

describe('Events organizers', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const createEvent = (body) => request({ path: '/', method: 'POST', headers: { 'X-Auth-Token': 'foobar' }, body });
    const editEvent = (event, body) => request({ path: '/single/' + event.id, method: 'PUT', headers: { 'X-Auth-Token': 'foobar' }, body });

    describe('creating', () => {
        test('should accept organizers from a cooperation body', async () => {
            mock.mockAll(creatorMocks({ [OUTSIDER]: [COOPERATION_BODY] }));

            const res = await createEvent(generator.generateEventBody({ cooperation: [{ body_id: COOPERATION_BODY }] }));

            expect(res.statusCode).toEqual(201);
        });

        test('should return 422 if an organizer is not in an organizing or cooperation body', async () => {
            mock.mockAll(creatorMocks({ [OUTSIDER]: [COOPERATION_BODY] }));

            const res = await createEvent(generator.generateEventBody());

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.organizers[0]).toEqual(`Organizers should be members of one of the organizing or cooperation bodies (user ID ${OUTSIDER}).`);
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
            expect(await Event.count()).toEqual(0);
        });

        test('should let people who manage the type add anyone', async () => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:create:summeruniversity', 'global:manage_summeruniversity:regular'] },
                member: { bodiesById: { [OUTSIDER]: [COOPERATION_BODY] } }
            });

            const res = await createEvent(generator.generateEventBody({ type: 'regular' }));

            expect(res.statusCode).toEqual(201);
        });

        test('should not let managers of another type add anyone', async () => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:create:summeruniversity', 'global:manage_summeruniversity:pilot'] },
                member: { bodiesById: { [user.id]: [ORGANIZING_BODY], [OUTSIDER]: [COOPERATION_BODY] } }
            });

            const res = await createEvent(generator.generateEventBody({ type: 'regular' }));

            expect(res.statusCode).toEqual(422);
        });

        test('should return 422 for organizers without a valid user_id', async () => {
            mock.mockAll(creatorMocks());
            const organizers = generator.generateOrganizers();
            organizers[1].user_id = 'abc';

            const res = await createEvent(generator.generateEventBody({ organizers }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.organizers[0]).toEqual('Every organizer should have a valid user_id.');
        });

        test('should return 422 for duplicated organizers', async () => {
            mock.mockAll(creatorMocks());
            const organizers = generator.generateOrganizers();
            organizers[2].user_id = organizers[1].user_id;

            const res = await createEvent(generator.generateEventBody({ organizers }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.organizers[0]).toEqual('Organizers should not be listed twice.');
        });

        test('should return 422 for more than 50 organizers', async () => {
            mock.mockAll(creatorMocks());
            const organizers = generator.generateOrganizers();
            for (let id = 2000; organizers.length < 51; id++) {
                organizers.push({ user_id: id, role: 'general_organizer' });
            }

            const res = await createEvent(generator.generateEventBody({ organizers }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.organizers[0]).toEqual('A Summer University can have at most 50 organizers.');
        });
    });

    describe('editing', () => {
        // An organizer without global permissions, editing an event in first approval.
        const organizerMocks = (bodiesById) => ({
            mainPermissions: { noPermissions: true },
            member: { bodiesById: { [user.id]: [ORGANIZING_BODY], ...bodiesById } },
            body: { echoId: true }
        });
        const createFirstApproval = () => generator.createEvent({ status: 'first approval', published: 'minimal' });

        test('should keep existing organizers even if they are not in an organizing body', async () => {
            mock.mockAll(organizerMocks({ [OUTSIDER]: [COOPERATION_BODY] }));
            const event = await createFirstApproval();

            const res = await editEvent(event, { organizers: event.organizers, description: 'Changed' });

            expect(res.statusCode).toEqual(200);
        });

        test('should return 422 for new organizers who are not in an organizing or cooperation body', async () => {
            const newOrganizer = 2001;
            mock.mockAll(organizerMocks({ [newOrganizer]: [COOPERATION_BODY] }));
            const event = await createFirstApproval();

            const res = await editEvent(event, { organizers: [...event.organizers, { user_id: newOrganizer, role: 'general_organizer' }] });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.organizers[0]).toContain(`user ID ${newOrganizer}`);
            expect(res.body.message).toEqual(Object.values(res.body.errors).flat().join(' '));
        });

        test('should accept new organizers from a cooperation body added in the same request', async () => {
            const newOrganizer = 2001;
            mock.mockAll(organizerMocks({ [newOrganizer]: [COOPERATION_BODY] }));
            const event = await createFirstApproval();

            const res = await editEvent(event, {
                cooperation: [{ body_id: COOPERATION_BODY }],
                organizers: [...event.organizers, { user_id: newOrganizer, role: 'general_organizer' }]
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.organizers.map((organizer) => organizer.user_id)).toContain(newOrganizer);
        });
    });
});
