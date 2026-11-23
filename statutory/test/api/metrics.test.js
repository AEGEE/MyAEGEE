const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock-core-registry');
const packageInfo = require('../../package.json');

describe('Metrics requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        // Other files count rows, so nothing is left behind.
        await generator.clearAll();
    });

    // Core rejects every token in these tests: the two routes never ask it.
    const rejectTokens = () => mock.mockAll({
        core: { unauthorized: true },
        mainPermissions: { unauthorized: true },
        approvePermissions: { unauthorized: true },
        memberslistPermissions: { unauthorized: true }
    });

    const count = (metrics, line) => {
        const found = metrics.split('\n').find((row) => row.startsWith(line + ' '));
        return found ? Number(found.slice(line.length + 1)) : 0;
    };

    test('should report what is stored on /metrics, without a token', async () => {
        rejectTokens();

        const event = await generator.createEvent({ type: 'agora', name: 'Agora Test' });
        await generator.createEvent({ type: 'epm', status: 'draft', name: 'EPM Test' });
        await generator.createApplication({ body_name: 'A body', participant_type: 'delegate' }, event);
        await generator.createApplication({ body_name: 'A body', participant_type: 'delegate' }, event);
        await generator.createApplication({ body_name: 'A body', participant_type: 'visitor' }, event);
        await generator.createMembersList({
            body_id: 34,
            members: [generator.generateMembersListMember(), generator.generateMembersListMember()]
        }, event);
        const position = await generator.createPosition({ name: 'President' }, event);
        await generator.createCandidate({ user_id: 1, status: 'pending' }, position);
        await generator.createCandidate({ user_id: 2, status: 'approved' }, position);
        await generator.createCandidate({ user_id: 3, status: 'approved' }, position);

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toMatch(/^text\/plain/);

        // The rows of one metric come in the order the database gives them.
        const lines = res.body.split('\n').filter((line) => line.startsWith('statutory_')).sort();
        expect(lines).toEqual([
            'statutory_events_total{type="agora",status="published"} 1',
            'statutory_events_total{type="epm",status="draft"} 1',
            'statutory_applications_total{body_name="A body",participant_type="delegate",event_name="Agora Test"} 2',
            'statutory_applications_total{body_name="A body",participant_type="visitor",event_name="Agora Test"} 1',
            'statutory_memberslists_total{event_name="Agora Test"} 1',
            // The number of members on the list of the body.
            'statutory_memberslists_by_event_and_body{body_id="34",event_name="Agora Test"} 2',
            'statutory_positions_total{event_name="Agora Test"} 1',
            // The status is the one of the position, not of the candidates.
            'statutory_candidates_total{status="open",position_name="President",event_name="Agora Test"} 3'
        ].sort());
    });

    test('should name only published events and their positions on /metrics', async () => {
        const createEventWithData = async (name, status) => {
            const event = await generator.createEvent({ type: 'agora', name, status });
            await generator.createApplication({}, event);
            await generator.createMembersList({}, event);
            const position = await generator.createPosition({ name: name + ' position' }, event);
            await generator.createCandidate({ user_id: 1, status: 'pending' }, position);
        };

        await createEventWithData('Published event of the metrics', 'published');
        await createEventWithData('Draft event of the metrics', 'draft');

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('Published event of the metrics');
        expect(res.body).toContain('Published event of the metrics position');
        expect(res.body).not.toContain('Draft event of the metrics');
    });

    test('should report nothing on /metrics when nothing is stored', async () => {
        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.split('\n').filter((line) => line.startsWith('statutory_'))).toEqual([]);
    });

    test('should count the requests by status, route and method on /metrics/requests, without a token', async () => {
        rejectTokens();
        const event = await generator.createEvent({ type: 'agora' });

        const read = async () => {
            const res = await request({
                path: '/metrics/requests',
                method: 'GET',
                responseType: 'text'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toMatch(/^text\/plain/);
            return res.body;
        };

        const lines = {
            healthcheck: 'statutory_requests_total{status="200",path="/healthcheck",method="GET"}',
            // The route as it is registered, not the url that was asked for.
            event: 'statutory_requests_total{status="200",path="/events/:event_id",method="GET"}',
            // A request that is refused before it reaches its route (no session here) has no route.
            refused: 'statutory_requests_total{status="401",path="unmatched",method="GET"}',
            unknown: 'statutory_requests_total{status="404",path="unmatched",method="GET"}'
        };

        const before = await read();

        await request({ path: '/healthcheck', method: 'GET' });
        await request({ path: '/events/' + event.id, method: 'GET' });
        await request({ path: '/events/' + event.url, method: 'GET' });
        await request({ path: '/mine', method: 'GET' });

        // With a session, as an unknown url answers 401 without one.
        mock.mockAll();
        await request({
            path: '/nothing/here',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
            skipOpenApi: 'the not-found handler'
        });

        const after = await read();

        expect(count(after, lines.healthcheck) - count(before, lines.healthcheck)).toEqual(1);
        expect(count(after, lines.event) - count(before, lines.event)).toEqual(2);
        expect(count(after, lines.refused) - count(before, lines.refused)).toEqual(1);
        expect(count(after, lines.unknown) - count(before, lines.unknown)).toEqual(1);
    });

    test('should return the name and the version on /healthcheck without a token', async () => {
        const res = await request({
            path: '/healthcheck',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({
            success: true,
            data: {
                name: packageInfo.name,
                description: packageInfo.description,
                version: packageInfo.version
            }
        });
    });
});
