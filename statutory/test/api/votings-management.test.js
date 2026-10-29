const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const lifecycle = require('../../lib/voting_lifecycle');
const { Voting } = require('../../models');

describe('Votings management', () => {
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
        cron.clearAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    describe('creating', () => {
        test('should create a voting that opens and closes at the given times', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const opensAt = moment().add(1, 'day').startOf('minute');
            const closesAt = moment(opensAt).add(10, 'minutes');

            const res = await call('POST', '/events/' + event.id + '/votings', {
                kind: 'proposal',
                title: 'Change of the Statutes',
                description: 'Proposal to change article 1.',
                majority: 'two_thirds',
                opens_at: opensAt.toISOString(),
                closes_at: closesAt.toISOString(),
                status: 'open',
                result: 'accepted',
                published: true
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.event_id).toEqual(event.id);
            expect(res.body.data.kind).toEqual('proposal');
            expect(res.body.data.title).toEqual('Change of the Statutes');
            expect(res.body.data.majority).toEqual('two_thirds');
            expect(res.body.data.opens_at).toEqual(opensAt.toISOString());
            expect(res.body.data.closes_at).toEqual(closesAt.toISOString());
            // status, result and published cannot be set directly
            expect(res.body.data.status).toEqual('scheduled');
            expect(res.body.data.result).toEqual(null);
            expect(res.body.data.published).toEqual(false);

            // The opening and the closing are scheduled.
            const jobs = Object.values(cron.jobs).filter((job) => job.params.id === res.body.data.id);
            expect(jobs.map((job) => [job.key, new Date(job.time).toISOString()]).sort()).toEqual([
                ['CLOSE_VOTING', closesAt.toISOString()],
                ['OPEN_VOTING', opensAt.toISOString()]
            ]);
        });

        test('should open a voting at once when opens_at is in the past', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({
                opens_at: moment().subtract(1, 'minute').toDate(),
                closes_at: moment().add(1, 'hour').toDate()
            }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('open');
            expect(res.body.data.opened_at).not.toEqual(null);
        });

        test.each([
            [{ opens_at: null, closes_at: moment().add(1, 'hour').toDate() }, 'opens_at'],
            [{ closes_at: null }, 'closes_at'],
            [{ opens_at: 'not a date', closes_at: moment().add(1, 'hour').toDate() }, 'opens_at'],
            [{ opens_at: moment().add(2, 'hours').toDate(), closes_at: moment().add(1, 'hour').toDate() }, 'closes_at'],
            [{ opens_at: moment().add(1, 'hour').toDate(), closes_at: moment().add(1, 'hour').toDate() }, 'closes_at']
        ])('should refuse the time window %j', async (window, field) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting(window));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
        });

        test('should create a rollcall', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ kind: 'rollcall', majority: 'simple' }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.kind).toEqual('rollcall');
        });

        test('should fail on an unknown kind', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ kind: 'election' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('kind');
        });

        test('should fail on an unknown majority', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ majority: 'most' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('majority');
        });

        test('should fail without a title', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ title: '' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('title');
        });

        test('should fail without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
        });

        test('should fail for an event that is not an Agora', async () => {
            const event = await generator.createEvent({ type: 'epm', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
        });

        test('should fail when the user is not authenticated', async () => {
            mock.mockAll({ core: { unauthorized: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(401);
        });
    });

    describe('listing and displaying', () => {
        test('should list all votings of the event for the JC, in the order they open', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createVoting({}, event);
            await generator.createOpenVoting({}, event);
            await generator.closeVoting(await generator.createOpenVoting({}, event));
            await generator.createVoting({}, otherEvent);

            const res = await call('GET', '/events/' + event.id + '/votings');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((voting) => voting.status)).toEqual(['closed', 'open', 'scheduled']);
        });

        test('should open and close the listed votings whose time has come', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);
            await generator.endVotingTime(voting);
            cron.clearAll(); // as if the job was missed

            const res = await call('GET', '/events/' + event.id + '/votings');

            expect(res.body.data.map((item) => item.status)).toEqual(['closed']);
        });

        test('should hide votings that did not open yet from users who cannot manage votings', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const scheduled = await generator.createVoting({}, event);
            await generator.createOpenVoting({}, event);

            const listRes = await call('GET', '/events/' + event.id + '/votings');
            expect(listRes.statusCode).toEqual(200);
            expect(listRes.body.data.map((voting) => voting.status)).toEqual(['open']);

            const singleRes = await call('GET', '/events/' + event.id + '/votings/' + scheduled.id);
            expect(singleRes.statusCode).toEqual(404);
        });

        test('should hide the result from users who cannot manage votings until it is published', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.closeVoting(await generator.createOpenVoting({ majority: 'simple' }, event));
            expect(voting.result).toEqual('rejected');

            const jcRes = await call('GET', '/events/' + event.id + '/votings/' + voting.id);
            expect(jcRes.body.data.result).toEqual('rejected');

            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const hiddenList = await call('GET', '/events/' + event.id + '/votings');
            const hiddenSingle = await call('GET', '/events/' + event.id + '/votings/' + voting.id);
            expect(hiddenList.body.data[0].result).toEqual(null);
            expect(hiddenSingle.body.data.result).toEqual(null);

            await voting.update({ published: true });
            const publishedSingle = await call('GET', '/events/' + event.id + '/votings/' + voting.id);
            expect(publishedSingle.body.data.result).toEqual('rejected');
        });

        test('should display a single voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ title: 'Activity Plan' }, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(voting.id);
            expect(res.body.data.title).toEqual('Activity Plan');
        });

        test('should find the event by its URL', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('GET', '/events/' + event.url + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(voting.id);
        });

        test('should return 404 for a voting of another event', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, otherEvent);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(404);
        });

        test('should return 400 for an invalid voting ID', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('GET', '/events/' + event.id + '/votings/abc');

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('editing and deleting', () => {
        test('should edit a voting that did not open yet', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ title: 'Old title', majority: 'simple' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title', status: 'closed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.title).toEqual('New title');
            expect(res.body.data.majority).toEqual('simple');
            expect(res.body.data.status).toEqual('scheduled');
        });

        test('should schedule the new times when the time window is edited', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);
            const opensAt = moment().add(3, 'days').startOf('minute');
            const closesAt = moment(opensAt).add(5, 'minutes');

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, {
                opens_at: opensAt.toISOString(),
                closes_at: closesAt.toISOString()
            });

            expect(res.statusCode).toEqual(200);
            const jobs = Object.values(cron.jobs).filter((job) => job.params.id === voting.id);
            expect(jobs.map((job) => [job.key, new Date(job.time).toISOString()]).sort()).toEqual([
                ['CLOSE_VOTING', closesAt.toISOString()],
                ['OPEN_VOTING', opensAt.toISOString()]
            ]);
        });

        test('should refuse an edit that makes the voting close before it opens', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, {
                closes_at: moment(voting.opens_at).subtract(1, 'minute').toISOString()
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('closes_at');
        });

        test('should refuse an edit that moves only the opening after the closing', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);
            const opensAt = voting.opens_at.toISOString();

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, {
                opens_at: moment(voting.closes_at).add(1, 'minute').toISOString()
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('closes_at');
            await voting.reload();
            expect(voting.opens_at.toISOString()).toEqual(opensAt);
        });

        test('should not edit a voting that opened after it was read', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({ title: 'Old title' }, event);
            const readBeforeOpening = jest.spyOn(lifecycle, 'syncVoting').mockImplementationOnce(async (found) => {
                found.status = 'scheduled';
                return found;
            });

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title' });
            readBeforeOpening.mockRestore();

            expect(res.statusCode).toEqual(409);
            await voting.reload();
            expect(voting.title).toEqual('Old title');
            expect(voting.status).toEqual('open');
        });

        test('should not delete a voting that opened after it was read', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);
            const readBeforeOpening = jest.spyOn(lifecycle, 'syncVoting').mockImplementationOnce(async (found) => {
                found.status = 'scheduled';
                return found;
            });

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);
            readBeforeOpening.mockRestore();

            expect(res.statusCode).toEqual(409);
            expect(await Voting.findByPk(voting.id)).not.toEqual(null);
        });

        test('should not edit a voting that is open', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({ title: 'Old title' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title' });

            expect(res.statusCode).toEqual(409);
            await voting.reload();
            expect(voting.title).toEqual('Old title');
        });

        test('should not edit without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title' });

            expect(res.statusCode).toEqual(403);
        });

        test('should delete a voting that did not open yet', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(await Voting.findByPk(voting.id)).toEqual(null);
        });

        test('should not delete a voting that is closed', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.closeVoting(await generator.createOpenVoting({}, event));

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(409);
            expect(await Voting.findByPk(voting.id)).not.toEqual(null);
        });

        test('should not delete without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createOpenVoting({}, event);

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(403);
        });
    });
});
