const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna, } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;

describe('Votes per antenna calculation', () => {
    const amounts = [
        { members: 1, votes: 1 },
        { members: 10, votes: 1 },
        { members: 15, votes: 1 },
        { members: 25, votes: 2 },
        { members: 75, votes: 3 },
        { members: 125, votes: 4 },
        { members: 175, votes: 5 },
        { members: 225, votes: 6 },
        { members: 300, votes: 7 },
        { members: 400, votes: 8 },
        { members: 500, votes: 9 },
        { members: 600, votes: 10 },
        { members: 700, votes: 11 },
        { members: 800, votes: 12 },
        { members: 900, votes: 13 },
        { members: 1000, votes: 14 },
        { members: 1100, votes: 14 },
        { members: 1200, votes: 15 },
        { members: 1450, votes: 16 }
    ];

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

    for (const amount of amounts) {
        test(`should save ${amount.votes} amount of votes for antenna with ${amount.members} members`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            const memberslist = generator.generateMembersList({
                body_id: regularUser.bodies[0].id,
                members: Array.from(
                    { length: amount.members },
                    (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                )
            });

            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: memberslist
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const votesInDatabase = await VotesPerAntenna.findAll();
            expect(votesInDatabase.length).toEqual(1);
            expect(votesInDatabase[0].body_id).toEqual(regularUser.bodies[0].id);
            expect(votesInDatabase[0].event_id).toEqual(event.id);
            expect(votesInDatabase[0].votes).toEqual(amount.votes);
        });
    }

    for (const type of ['contact', 'contact antenna']) {
        test(`should save 0 votes for ${type}`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, body: { type } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            const memberslist = generator.generateMembersList({
                body_id: regularUser.bodies[0].id,
                members: Array.from(
                    { length: 175 }, // in theory, 5 votes
                    (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                )
            });

            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: memberslist
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const votesInDatabase = await VotesPerAntenna.findAll();
            expect(votesInDatabase.length).toEqual(1);
            expect(votesInDatabase[0].body_id).toEqual(regularUser.bodies[0].id);
            expect(votesInDatabase[0].event_id).toEqual(event.id);
            expect(votesInDatabase[0].votes).toEqual(0);
        });
    }

    test('should recalculate the votes for antenna on memberslists upload', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, body: { type: 'antenna' } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        let memberslist = generator.generateMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 175 },
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        });

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: memberslist
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const votesInDatabase = await VotesPerAntenna.findAll();
        expect(votesInDatabase.length).toEqual(1);
        expect(votesInDatabase[0].body_id).toEqual(regularUser.bodies[0].id);
        expect(votesInDatabase[0].event_id).toEqual(event.id);
        expect(votesInDatabase[0].votes).toEqual(5);

        // Reuploading members lists
        memberslist = generator.generateMembersList({
            body_id: regularUser.bodies[0].id,
            members: Array.from(
                { length: 30 }, // in theory, 2 votes
                (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
            )
        });

        // to recalculate votes amount for antenna
        const secondRes = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: memberslist
        });

        expect(secondRes.statusCode).toEqual(200);
        expect(secondRes.body.success).toEqual(true);
        expect(secondRes.body).toHaveProperty('data');

        // Votes should be updated.
        const votesInDbAfterUpdate = await VotesPerAntenna.findAll();

        expect(votesInDbAfterUpdate.length).toEqual(1);
        expect(votesInDbAfterUpdate[0].body_id).toEqual(regularUser.bodies[0].id);
        expect(votesInDbAfterUpdate[0].event_id).toEqual(event.id);
        expect(votesInDbAfterUpdate[0].votes).toEqual(2);
    });

    describe('at the edges of each number of members', () => {
        // The first and the last number of members of every row of the table of votes. From 951
        // members on there is one more vote for every 250 members, counted here from 950: the
        // fifteenth vote comes with member 1200.
        test.each([
            [1, 1], [20, 1],
            [21, 2], [50, 2],
            [51, 3], [100, 3],
            [101, 4], [150, 4],
            [151, 5], [200, 5],
            [201, 6], [250, 6],
            [251, 7], [350, 7],
            [351, 8], [450, 8],
            [451, 9], [550, 9],
            [551, 10], [650, 10],
            [651, 11], [750, 11],
            [751, 12], [850, 12],
            [851, 13], [950, 13],
            [951, 14], [1199, 14],
            [1200, 15], [1449, 15],
            [1450, 16]
        ])('gives an antenna with %i members %i votes', async (members, votes) => {
            const body = { id: regularUser.bodies[0].id, type: 'antenna' };
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createMembersList({
                body_id: body.id,
                members: Array.from({ length: members }, () => ({ first_name: 'First', last_name: 'Last', fee: 10 }))
            }, event);

            await VotesPerAntenna.recalculateVotesForAntenna(body, event);

            const votesInDatabase = await VotesPerAntenna.findAll();
            expect(votesInDatabase.map((row) => [row.event_id, row.body_id, row.votes])).toEqual([[event.id, body.id, votes]]);
        });

        test('gives an antenna without a members list for this Agora no votes', async () => {
            const body = { id: regularUser.bodies[0].id, type: 'antenna' };
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createMembersList({ body_id: body.id }, otherEvent);

            await VotesPerAntenna.recalculateVotesForAntenna(body, event);

            const votesInDatabase = await VotesPerAntenna.findAll();
            expect(votesInDatabase.map((row) => [row.event_id, row.body_id, row.votes])).toEqual([[event.id, body.id, 0]]);
        });
    });
});
