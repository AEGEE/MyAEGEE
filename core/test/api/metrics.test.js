const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Metrics requests', () => {
    beforeEach(async () => {
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
    });

    test('should return data correctly on /metrics', async () => {
        await generator.createBody();

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });

    test('should return data correctly on /metrics/requests', async () => {
        const res = await request({
            path: '/metrics/requests',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
    });

    describe('data on /metrics', () => {
        const getMetrics = async () => {
            const res = await request({
                path: '/metrics',
                method: 'GET',
                responseType: 'text'
            });

            expect(res.statusCode).toEqual(200);
            return res;
        };

        // The lines of one metric, without the comments.
        const linesOf = (text, name) => text.split('\n').filter((line) => line.startsWith(name + '{') || line.startsWith(name + ' ')).sort();

        test('should be in the text format of Prometheus', async () => {
            const res = await getMetrics();

            expect(res.headers['content-type']).toMatch(/^text\/plain; version=0\.0\.4/);
            for (const name of [
                'core_members_total',
                'core_bodies_total',
                'core_circles_total',
                'core_body_memberships_total',
                'core_circle_memberships_total',
                'core_join_requests_total'
            ]) {
                expect(res.body).toContain(`# TYPE ${name} gauge`);
            }
            expect(res.body).toContain('# TYPE core_password_reset_failures_total counter');
        });

        test('should count the members by whether they are active', async () => {
            await generator.createUser();
            await generator.createUser({ mail_confirmed_at: null });
            await generator.createUser({ active: false });

            const res = await getMetrics();

            expect(linesOf(res.body, 'core_members_total')).toEqual([
                'core_members_total{active="false"} 1',
                'core_members_total{active="true"} 2'
            ]);
        });

        test('should count the bodies by status and type', async () => {
            await generator.createBody({ type: 'antenna' });
            await generator.createBody({ type: 'antenna' });
            await generator.createBody({ type: 'contact' });
            await generator.createBody({ type: 'antenna', status: 'deleted' });

            const res = await getMetrics();

            expect(linesOf(res.body, 'core_bodies_total')).toEqual([
                'core_bodies_total{status="active",type="antenna"} 2',
                'core_bodies_total{status="active",type="contact"} 1',
                'core_bodies_total{status="deleted",type="antenna"} 1'
            ]);
        });

        test('should count the circles and the memberships of each body', async () => {
            const body = await generator.createBody({ name: 'AEGEE-Somewhere' });
            const otherBody = await generator.createBody({ name: 'AEGEE-Elsewhere' });
            const board = await generator.createCircle({ name: 'Board', body_id: body.id });
            await generator.createCircle({ name: 'Members', body_id: body.id });
            // A circle without a body is not counted for any body.
            const freeCircle = await generator.createCircle({ name: 'Free circle' });

            const first = await generator.createUser();
            const second = await generator.createUser();
            await generator.createBodyMembership(body, first);
            await generator.createBodyMembership(body, second);
            await generator.createBodyMembership(otherBody, first);
            await generator.createCircleMembership(board, first);
            await generator.createCircleMembership(board, second);
            await generator.createCircleMembership(freeCircle, first);
            await generator.createJoinRequest(otherBody, second);

            const res = await getMetrics();

            expect(linesOf(res.body, 'core_circles_total')).toEqual([
                `core_circles_total{body_id="${body.id}",body_name="AEGEE-Somewhere"} 2`
            ]);
            expect(linesOf(res.body, 'core_body_memberships_total')).toEqual([
                `core_body_memberships_total{body_id="${body.id}",body_name="AEGEE-Somewhere"} 2`,
                `core_body_memberships_total{body_id="${otherBody.id}",body_name="AEGEE-Elsewhere"} 1`
            ].sort());
            expect(linesOf(res.body, 'core_circle_memberships_total')).toEqual([
                `core_circle_memberships_total{circle_id="${board.id}",circle_name="Board"} 2`,
                `core_circle_memberships_total{circle_id="${freeCircle.id}",circle_name="Free circle"} 1`
            ].sort());
            expect(linesOf(res.body, 'core_join_requests_total')).toEqual([
                `core_join_requests_total{body_id="${otherBody.id}",body_name="AEGEE-Elsewhere",status="pending"} 1`
            ]);
        });

        test('should forget what is not there anymore', async () => {
            const body = await generator.createBody({ type: 'antenna' });
            const user = await generator.createUser();
            await generator.createBodyMembership(body, user);

            const before = await getMetrics();
            expect(linesOf(before.body, 'core_body_memberships_total').length).toEqual(1);

            await generator.clearAll();

            const after = await getMetrics();
            expect(linesOf(after.body, 'core_members_total')).toEqual([]);
            expect(linesOf(after.body, 'core_bodies_total')).toEqual([]);
            expect(linesOf(after.body, 'core_body_memberships_total')).toEqual([]);
        });

        test('should have no names or addresses of members', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser({
                username: 'zzusername',
                first_name: 'Zzfirstname',
                last_name: 'Zzlastname',
                email: 'zzemail@example.com'
            });
            await generator.createBodyMembership(body, user);

            const res = await getMetrics();

            expect(res.body.toLowerCase()).not.toContain('zzusername');
            expect(res.body.toLowerCase()).not.toContain('zzfirstname');
            expect(res.body.toLowerCase()).not.toContain('zzlastname');
            expect(res.body.toLowerCase()).not.toContain('zzemail');
        });

        test('should count the password resets that failed, starting at 0', async () => {
            const res = await getMetrics();

            expect(linesOf(res.body, 'core_password_reset_failures_total')).toEqual(['core_password_reset_failures_total 0']);
        });
    });

    describe('data on /metrics/requests', () => {
        const getRequestMetrics = async () => {
            const res = await request({
                path: '/metrics/requests',
                method: 'GET',
                responseType: 'text'
            });

            expect(res.statusCode).toEqual(200);
            return res;
        };

        // How often the route was answered with the status so far. The counter is kept as long as the process runs.
        const countOf = (text, status, path, method) => {
            const line = text.split('\n').find((item) => item.startsWith(`core_requests_total{status="${status}",path="${path}",method="${method}"} `));

            return line ? Number(line.split(' ').pop()) : 0;
        };

        test('should be in the text format of Prometheus', async () => {
            const res = await getRequestMetrics();

            expect(res.headers['content-type']).toMatch(/^text\/plain; version=0\.0\.4/);
            expect(res.body).toContain('# TYPE core_requests_total counter');
        });

        test('should count a request by its status, its route and its method', async () => {
            const body = await generator.createBody();
            const before = (await getRequestMetrics()).body;

            await request({ path: '/bodies', method: 'GET' });
            await request({ path: '/bodies', method: 'GET' });
            await request({ path: '/bodies/' + body.id, method: 'GET' });
            await request({ path: '/bodies/2147483647', method: 'GET' });
            await request({ path: '/login', method: 'POST', body: { username: 'nobody', password: 'testtest' } });

            const after = (await getRequestMetrics()).body;

            expect(countOf(after, 200, '/bodies', 'GET') - countOf(before, 200, '/bodies', 'GET')).toEqual(2);
            expect(countOf(after, 200, '/bodies/:body_id', 'GET') - countOf(before, 200, '/bodies/:body_id', 'GET')).toEqual(1);
            expect(countOf(after, 403, '/login', 'POST') - countOf(before, 403, '/login', 'POST')).toEqual(1);

            // The route is the pattern, so the ids that are asked for are not in the labels.
            expect(after).not.toContain(String(body.id));
            expect(after).not.toContain('2147483647');
        });

        test('should count a request that no route answered as unmatched', async () => {
            const before = (await getRequestMetrics()).body;

            await request({ path: '/there-is-no-such-route', method: 'GET', skipOpenApi: 'checks how an unknown route is counted' });

            const after = (await getRequestMetrics()).body;

            expect(countOf(after, 404, 'unmatched', 'GET') - countOf(before, 404, 'unmatched', 'GET')).toEqual(1);
            expect(after).not.toContain('there-is-no-such-route');
        });

        test('should not count the requests for the metrics themselves', async () => {
            await request({ path: '/metrics', method: 'GET', responseType: 'text' });
            await getRequestMetrics();

            const res = await getRequestMetrics();

            expect(res.body).not.toContain('path="/metrics');
        });

        test('should have no tokens, names or addresses', async () => {
            const user = await generator.createUser({ username: 'zzusername', email: 'zzemail@example.com' });
            const token = await generator.createAccessToken(user);

            await request({ path: '/members/zzusername', method: 'GET', headers: { 'X-Auth-Token': token.value } });
            await request({ path: '/members_email', method: 'GET', query: { query: String(user.id) }, headers: { 'X-Auth-Token': token.value } });

            const res = await getRequestMetrics();

            expect(res.body).toContain('path="/members/:user_id"');
            expect(res.body).toContain('path="/members_email"');
            expect(res.body).not.toContain('zzusername');
            expect(res.body).not.toContain('zzemail');
            expect(res.body).not.toContain(token.value);
        });
    });
});
