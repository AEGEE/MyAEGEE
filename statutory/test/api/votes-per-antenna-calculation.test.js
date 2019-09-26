const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna, } = require('../../models');
const regularUser = require('../assets/oms-core-valid').data;

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
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
});
