const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;

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
            path: '/events/' + event.id + '/votes-amounts/antenna',
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
            confirmed: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            path: '/events/' + event.id + '/votes-amounts/delegate',
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
            confirmed: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            path: '/events/' + event.id + '/votes-amounts/nan',
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
            confirmed: true,
            registered: true
        }, event);
        await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

        const res = await request({
            path: '/events/' + event.id + '/votes-amounts/' + regularUser.bodies[0].id,
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

    describe('delegate application fields', () => {
        const DELEGATE_APPLICATION_FIELDS = ['body_id', 'statutory_id', 'user_id'];
        let event;
        let application;

        beforeEach(async () => {
            // A member without any permissions can see the votes.
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createMembersList({
                body_id: regularUser.bodies[0].id,
                members: Array.from(
                    { length: 175 }, // in theory, 5 votes
                    (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                )
            }, event);
            application = await generator.createApplication({
                user_id: regularUser.id,
                participant_type: 'delegate',
                participant_order: 1,
                body_id: regularUser.bodies[0].id,
                cancelled: false,
                confirmed: true,
                registered: true,
                visa_required: true,
                allergies: 'Some allergies',
                board_comment: 'Some board comment'
            }, event);
            await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);
        });

        test('should return only the statutory ID, user and body of the application per delegate', async () => {
            const res = await request({
                path: '/events/' + event.id + '/votes-amounts/delegate',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.length).toEqual(2); // off-event. on-event

            for (const vote of res.body.data) {
                expect(Object.keys(vote.application).sort()).toEqual(DELEGATE_APPLICATION_FIELDS);
                expect(vote.application.statutory_id).toEqual(application.statutory_id);
                expect(vote.application.user_id).toEqual(regularUser.id);
                expect(vote.application.body_id).toEqual(regularUser.bodies[0].id);
            }
        });

        test('should return only the statutory ID, user and body of the application per delegate for 1 antenna', async () => {
            const res = await request({
                path: '/events/' + event.id + '/votes-amounts/' + regularUser.bodies[0].id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.delegate.length).toEqual(2); // off-event. on-event

            for (const vote of res.body.data.delegate) {
                expect(Object.keys(vote.application).sort()).toEqual(DELEGATE_APPLICATION_FIELDS);
                expect(vote.application.statutory_id).toEqual(application.statutory_id);
                expect(vote.application.user_id).toEqual(regularUser.id);
                expect(vote.application.body_id).toEqual(regularUser.bodies[0].id);
            }
        });
    });

    describe('who sees the votes, and of which event', () => {
        const bodyId = regularUser.bodies[0].id;
        const routes = [
            ['/votes-amounts/antenna'],
            ['/votes-amounts/delegate'],
            ['/votes-amounts/' + bodyId]
        ];

        // An Agora with 5 votes for the caller's body, all with its one confirmed delegate.
        const createAgoraWithVotes = async (userId) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createMembersList({
                body_id: bodyId,
                members: Array.from({ length: 175 }, () => generator.generateMembersListMember())
            }, event);
            await generator.createApplication({
                user_id: userId,
                participant_type: 'delegate',
                participant_order: 1,
                body_id: bodyId,
                confirmed: true
            }, event);
            await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);

            return event;
        };

        const get = (event, route) => request({
            path: '/events/' + event.id + route,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('shows a member without permissions the votes per antenna of this Agora only', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });
            const event = await createAgoraWithVotes(1337);
            await createAgoraWithVotes(1338);

            const res = await get(event, '/votes-amounts/antenna');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((votes) => [votes.event_id, votes.body_id, votes.votes])).toEqual([[event.id, bodyId, 5]]);
        });

        test('shows a member without permissions the votes per delegate of this Agora only', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });
            const event = await createAgoraWithVotes(1337);
            await createAgoraWithVotes(1338);

            const res = await get(event, '/votes-amounts/delegate');

            expect(res.statusCode).toEqual(200);
            // Not registered at the event yet, so there are only the votes off the event.
            expect(res.body.data.map((votes) => [votes.event_id, votes.user_id, votes.type, votes.votes]))
                .toEqual([[event.id, 1337, 'off-event', 5]]);
        });

        test('shows a member without permissions the votes of one body at this Agora only', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });
            const event = await createAgoraWithVotes(1337);
            await createAgoraWithVotes(1338);

            const res = await get(event, '/votes-amounts/' + bodyId);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.antenna.event_id).toEqual(event.id);
            expect(res.body.data.antenna.votes).toEqual(5);
            expect(res.body.data.delegate.map((votes) => [votes.event_id, votes.user_id, votes.votes])).toEqual([[event.id, 1337, 5]]);
        });

        test('answers with no votes for a body that has none at this Agora', async () => {
            const event = await createAgoraWithVotes(1337);

            const res = await get(event, '/votes-amounts/2147483647');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, data: { antenna: null, delegate: [] } });
        });

        // BUG: "Infinity" passes the check that the body id is a number and reaches the query, which
        // fails. Expected: 400, as for any other value that is not a body id.
        test('answers 500 for the body id Infinity', async () => {
            const event = await createAgoraWithVotes(1337);

            const res = await get(event, '/votes-amounts/Infinity');

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
        });

        describe.each(['epm', 'spm'])('of an %s event', (type) => {
            test.each(routes)('answers 400 on %s', async (route) => {
                const event = await generator.createEvent({ type, applications: [] });

                const res = await get(event, route);

                expect(res.statusCode).toEqual(400);
                expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            });
        });
    });
});
