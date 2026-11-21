const express = require('express');

const endpointsMetrics = require('../../lib/endpoints_metrics');

describe('Endpoint metrics', () => {
    let server;
    let baseUrl;

    const getRequestsMetrics = async () => {
        const res = await fetch(baseUrl + '/metrics/requests');
        return res.text();
    };

    beforeAll(async () => {
        const app = express();
        const GeneralRouter = express.Router({ mergeParams: true });
        const ThingsRouter = express.Router({ mergeParams: true });
        const PartsRouter = express.Router({ mergeParams: true });
        const PrivateRouter = express.Router({ mergeParams: true });

        GeneralRouter.get('/metrics/requests', endpointsMetrics.getEndpointMetrics);
        GeneralRouter.get('/', (req, res) => res.json({}));
        GeneralRouter.get('/things', (req, res) => res.json({}));
        ThingsRouter.get('/', (req, res) => res.json({}));
        PartsRouter.get('/:part_id', (req, res) => res.json({}));
        PrivateRouter.use((req, res) => res.status(401).json({}));
        PrivateRouter.get('/:secret_id', (req, res) => res.json({}));

        app.use(endpointsMetrics.addEndpointMetrics);
        app.use('/things/:thing_id', endpointsMetrics.recordMountPath('/things/:thing_id'), ThingsRouter);
        app.use('/things/:thing_id/parts', endpointsMetrics.recordMountPath('/things/:thing_id/parts'), PartsRouter);
        app.use('/private', endpointsMetrics.recordMountPath('/private'), PrivateRouter);
        app.use('/', endpointsMetrics.recordMountPath('/'), GeneralRouter);
        app.use((req, res) => res.status(404).json({}));

        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        baseUrl = 'http://localhost:' + server.address().port;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    test('should label requests with the route pattern including the mount pattern', async () => {
        // passes through the /things/:thing_id router before matching in the /things/:thing_id/parts one
        await fetch(baseUrl + '/things/42/parts/7?foo=bar');

        const metrics = await getRequestsMetrics();
        expect(metrics).toContain('path="/things/:thing_id/parts/:part_id"');
        expect(metrics).not.toContain('path="/things/42');
        expect(metrics).not.toContain('endpoint=');
    });

    test('should label the root route of a mounted router with the mount pattern', async () => {
        await fetch(baseUrl + '/things/42');

        const metrics = await getRequestsMetrics();
        expect(metrics).toContain('path="/things/:thing_id"');
    });

    test('should label routes on the root mount with the route pattern', async () => {
        await fetch(baseUrl + '/things?foo=bar');

        const metrics = await getRequestsMetrics();
        expect(metrics).toContain('path="/things"');
        expect(metrics).not.toContain('path="/things?foo=bar"');
    });

    test('should label the root route on the root mount as /', async () => {
        await fetch(baseUrl + '/');

        const metrics = await getRequestsMetrics();
        expect(metrics).toMatch(/status="200",path="\/",method="GET"/);
    });

    test('should label requests that match no route as unmatched', async () => {
        await fetch(baseUrl + '/nonexistent/42');
        await fetch(baseUrl + '/things/42/nonexistent');

        const metrics = await getRequestsMetrics();
        expect(metrics).toMatch(/status="404",path="unmatched",method="GET"} 2$/m);
    });

    test('should label requests answered by router-level middleware as unmatched', async () => {
        await fetch(baseUrl + '/private/42');

        const metrics = await getRequestsMetrics();
        expect(metrics).toMatch(/status="401",path="unmatched",method="GET"} 1$/m);
    });
});
