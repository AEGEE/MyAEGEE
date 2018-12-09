const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { VotesPerAntenna, VotesPerDelegate } = require('../../models');
const regularUser = require('../assets/oms-core-valid').data;

describe('Votes per antenna/delegate recalculation', () => {
    describe('should update if something would be updated', () => {
        let event;
        let memberslist;
        beforeEach(async () => {
            mock.mockAll();
            await startServer();

            event = await generator.createEvent({ type: 'agora', applications: [] });
            memberslist = generator.generateMembersList({
                body_id: regularUser.bodies[0].id,
                members: Array.from(
                    { length: 175 }, // in theory, 5 votes
                    (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                )
            });

            // to recalculate votes amount for antenna
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: memberslist
            });

            if (res.statusCode !== 200) {
                throw new Error('Error uploading memberslist: ' + JSON.stringify(res.body));
            }
        });

        afterEach(async () => {
            await stopServer();
            await generator.clearAll();
            mock.cleanAll();
        });

        test('should recalculate the votes when a person is marked as attended', async () => {
            const application = await generator.createApplication({
                user_id: regularUser.id,
                participant_type: 'delegate',
                participant_order: 1,
                body_id: regularUser.bodies[0].id,
                cancelled: false,
                paid_fee: true
            }, event);
            await VotesPerAntenna.recalculateVotesForDelegates(event, regularUser.bodies[0].id);

            // There should be votes distributed to this delegate
            const votesInDb = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDb.length).toEqual(1);
            expect(votesInDb[0].votes).toEqual(5);

            const res = await request({
                uri: '/events/' + event.id + '/applications/' + application.id + '/attended',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { attended: true }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            // Votes should be updated.
            const votesInDbAfterUpdate = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDbAfterUpdate.length).toEqual(2);
        });

        test('should recalculate the votes when a person is marked as departed', async () => {
            const application = await generator.createApplication({
                user_id: regularUser.id,
                participant_type: 'delegate',
                participant_order: 1,
                body_id: regularUser.bodies[0].id,
                cancelled: false,
                paid_fee: true,
                attended: true
            }, event);
            await VotesPerAntenna.recalculateVotesForDelegates(event, regularUser.bodies[0].id);

            // There should be votes distributed to this delegate
            const votesInDb = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDb.length).toEqual(2);

            const res = await request({
                uri: '/events/' + event.id + '/applications/' + application.id + '/departed',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { departed: true }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            // Votes should be updated.
            const votesInDbAfterUpdate = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDbAfterUpdate.length).toEqual(1);
        });

        test('should recalculate the votes on memberslists upload', async () => {
            const application = await generator.createApplication({
                user_id: regularUser.id,
                participant_type: 'delegate',
                participant_order: 1,
                body_id: regularUser.bodies[0].id,
                cancelled: false,
                paid_fee: true
            }, event);
            await VotesPerAntenna.recalculateVotesForDelegates(event, regularUser.bodies[0].id);

            // There should be votes distributed to this delegate
            const votesInDb = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDb.length).toEqual(1);

            // Reuploading members lists
            memberslist = generator.generateMembersList({
                body_id: regularUser.bodies[0].id,
                members: Array.from(
                    { length: 30 }, // in theory, 2 votes
                    (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                )
            });

            // to recalculate votes amount for antenna
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: memberslist
            });

            if (res.statusCode !== 200) {
                throw new Error('Error uploading memberslist')
            }

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            // Votes should be updated.
            const votesInDbAfterUpdate = await VotesPerDelegate.findAll({
                where: {
                    event_id: event.id,
                    body_id: regularUser.bodies[0].id,
                    user_id: regularUser.id
                }
            });

            expect(votesInDbAfterUpdate.length).toEqual(1);
            expect(votesInDbAfterUpdate[0].votes).toEqual(2);
        });
    });

    describe('Proper numbers', () => {
        const distributions = [
            { delegates: 1, members: 10, votes: [1] },
            { delegates: 2, members: 10, votes: [1, 0] },
            { delegates: 3, members: 10, votes: [1, 0, 0] },
            { delegates: 1, members: 30, votes: [2] },
            { delegates: 2, members: 30, votes: [1, 1] },
            { delegates: 3, members: 30, votes: [1, 1, 0] },
            { delegates: 1, members: 75, votes: [3] },
            { delegates: 2, members: 75, votes: [2, 1] },
            { delegates: 3, members: 75, votes: [1, 1, 1] },
            { delegates: 1, members: 125, votes: [4] },
            { delegates: 2, members: 125, votes: [2, 2] },
            { delegates: 3, members: 125, votes: [2, 1, 1] },
            { delegates: 1, members: 175, votes: [5] },
            { delegates: 2, members: 175, votes: [3, 2] },
            { delegates: 3, members: 175, votes: [2, 2, 1] },
            { delegates: 1, members: 225, votes: [6] },
            { delegates: 2, members: 225, votes: [3, 3] },
            { delegates: 3, members: 225, votes: [2, 2, 2] },
        ];

        afterEach(async () => {
            await generator.clearAll();
            mock.cleanAll();
        });

        for (const distribution of distributions) {
            test(`should distribute votes between ${distribution.delegates} delegates and ${distribution.members} members as ${distribution.votes}`, async () => {
                // Creating an event and a memberslist.
                const event = await generator.createEvent({ type: 'agora', applications: [] });
                await generator.createMembersList({
                    body_id: regularUser.bodies[0].id,
                    members: Array.from(
                        { length: distribution.members },
                        (value, index) => generator.generateMembersListMember({ user_id: index + 1 })
                    )
                }, event);

                // Creating applications.
                for (let index = 0; index < distribution.delegates; index++) {
                    await generator.createApplication({
                        user_id: index + 1,
                        body_id: regularUser.bodies[0].id,
                        participant_type: 'delegate',
                        participant_order: index + 1,
                        attended: true,
                        paid_fee: true,
                        departed: false
                    }, event);
                }

                // Recalculating the votes.
                await VotesPerAntenna.recalculateVotesForAntenna(regularUser.bodies[0], event);


                // And checking how much do we have.
                const votes = await VotesPerDelegate.findAll({
                    where: { event_id: event.id, body_id: regularUser.bodies[0].id, type: 'on-event' },
                    order: [['user_id', 'ASC']] // Well they have the same user_id as pax_order.
                });

                const votesDistribution = votes.map(v => v.votes);
                expect(votesDistribution.length).toEqual(distribution.votes.length);
                expect(votesDistribution).toEqual(distribution.votes);
            });
        }
    });
});
