const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna } = require('../../models');
const regularUser = require('../assets/oms-core-valid').data;

describe('Votes amounts listing', () => {
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

    test('should return proper amount of votes per antenna', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 175 }, // in theory, 5 votes
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            uri: '/events/' + event.id + '/votes-amounts/antenna',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data[0].votes).toEqual(5);
    });

    test('should return proper amount of votes per delegate', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 175 }, // in theory, 5 votes
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        }, event);
        const application = await generator.createApplication({
            user_id: regularUser.id,
            participant_type: 'delegate',
            participant_order: 1,
            body_id: regularUser.bodies[0].id,
            cancelled: false,
            paid_fee: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            uri: '/events/' + event.id + '/votes-amounts/delegate',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2); // off-event. on-event
        expect(res.body.data[0].body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data[0].application_id).toEqual(application.id);
        expect(res.body.data[0].user_id).toEqual(regularUser.id);
        expect(res.body.data[0].votes).toEqual(5);
        expect(res.body.data[1].body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data[1].application_id).toEqual(application.id);
        expect(res.body.data[1].user_id).toEqual(regularUser.id);
        expect(res.body.data[1].votes).toEqual(5);
    });

    test('should return error on malformed body ID', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 175 }, // in theory, 5 votes
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        }, event);
        await generator.createApplication({
            user_id: regularUser.id,
            participant_type: 'delegate',
            participant_order: 1,
            body_id: regularUser.bodies[0].id,
            cancelled: false,
            paid_fee: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            uri: '/events/' + event.id + '/votes-amounts/nan',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should return proper amount of votes per antenna/delegate for 1 antenna', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 175 }, // in theory, 5 votes
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        }, event);
        const application = await generator.createApplication({
            user_id: regularUser.id,
            participant_type: 'delegate',
            participant_order: 1,
            body_id: regularUser.bodies[0].id,
            cancelled: false,
            paid_fee: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            uri: '/events/' + event.id + '/votes-amounts/' + regularUser.bodies[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('antenna');
        expect(res.body.data).toHaveProperty('delegate');

        expect(res.body.data.antenna.body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data.antenna.votes).toEqual(5);

        expect(res.body.data.delegate.length).toEqual(2); // off-event. on-event
        expect(res.body.data.delegate[0].body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data.delegate[0].application_id).toEqual(application.id);
        expect(res.body.data.delegate[0].user_id).toEqual(regularUser.id);
        expect(res.body.data.delegate[0].votes).toEqual(5);
        expect(res.body.data.delegate[1].body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data.delegate[1].application_id).toEqual(application.id);
        expect(res.body.data.delegate[1].user_id).toEqual(regularUser.id);
        expect(res.body.data.delegate[1].votes).toEqual(5);
    });
});
