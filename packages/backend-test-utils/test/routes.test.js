const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { instrumentExpress, listExpressRoutes, listSpecOperations, listOperations } = require('../routes');
const { createContract } = require('../openapi');
const { FIXTURES, REQUIRE_FROM, requireFromService } = require('./helpers');

const express = requireFromService('express');
const noop = (req, res) => res.end();
const { spec } = createContract({ serviceRoot: FIXTURES, requireFrom: REQUIRE_FROM });

// Builds an app the way the services' lib/server.js do, with the recorder on.
function record(build) {
    const restore = instrumentExpress(express);
    try {
        return build();
    } finally {
        restore();
    }
}

// The routes of the fixture spec, registered like a service would.
function fixtureApp({ skip = [], extra = () => {} } = {}) {
    return record(() => {
        const app = express();
        const general = express.Router();
        const courses = express.Router({ mergeParams: true });
        app.use(express.json());
        general.use((req, res, next) => next());
        if (!skip.includes('healthcheck')) general.get('/healthcheck', noop);
        general.get('/metrics', noop);
        general.get('/members/me', noop);
        general.get('/members/:user_id', noop);
        general.get('/courses', noop);
        general.post('/courses', noop);
        courses.get('/', noop);
        courses.delete('/', noop);
        courses.get('/export', noop);
        extra(general);
        app.use('/courses/:course_id', courses);
        app.use('/', general);
        return app;
    });
}

describe('listExpressRoutes', () => {
    test('lists the routes of nested routers mounted with path parameters, in OpenAPI style', () => {
        assert.deepEqual(listExpressRoutes(fixtureApp()), [
            'DELETE /courses/{course_id}',
            'GET /courses',
            'GET /courses/{course_id}',
            'GET /courses/{course_id}/export',
            'GET /healthcheck',
            'GET /members/me',
            'GET /members/{user_id}',
            'GET /metrics',
            'POST /courses'
        ]);
    });

    test('route parity: the fixture app and the fixture spec list the same operations', () => {
        assert.deepEqual(listExpressRoutes(fixtureApp()), listSpecOperations(spec));
    });

    test('route parity fails both ways: a route missing from the spec, and a spec operation the router lacks', () => {
        const routes = listExpressRoutes(fixtureApp({ skip: ['healthcheck'], extra: (r) => r.put('/members/:user_id', noop) }));
        const documented = listSpecOperations(spec);
        assert.deepEqual({
            undocumented: routes.filter((r) => !documented.includes(r)),
            notInExpress: documented.filter((d) => !routes.includes(d))
        }, { undocumented: ['PUT /members/{user_id}'], notInExpress: ['GET /healthcheck'] });
    });

    test('ignores HEAD and records deeper nesting', () => {
        const app = record(() => {
            const server = express();
            const inner = express.Router();
            const outer = express.Router();
            inner.route('/items/:item_id').get(noop).head(noop).put(noop);
            outer.use('/b/:b_id', inner);
            server.use('/a/:a_id/', outer);
            return server;
        });
        assert.deepEqual(listExpressRoutes(app), ['GET /a/{a_id}/b/{b_id}/items/{item_id}', 'PUT /a/{a_id}/b/{b_id}/items/{item_id}']);
    });

    test('a route registered with a regular expression or an array of paths throws', () => {
        const regexp = record(() => {
            const server = express();
            server.get(/ab+c/, noop);
            return server;
        });
        assert.throws(() => listExpressRoutes(regexp), /registered with a regular expression .*register each path as a string/);
        const paths = record(() => {
            const server = express();
            server.get(['/a', '/b'], noop);
            return server;
        });
        assert.throws(() => listExpressRoutes(paths), /registered with an array of paths .*register each path as a string/);
    });

    test('all() throws: every method must be registered and documented explicitly', () => {
        const appAll = record(() => {
            const server = express();
            server.all('/anything', noop);
            return server;
        });
        assert.throws(() => listExpressRoutes(appAll), /all\(\) on \/anything: register each method explicitly/);
        const routeAll = record(() => {
            const server = express();
            const router = express.Router();
            router.route('/thing').all(noop);
            server.use('/x/:id', router);
            return server;
        });
        assert.throws(() => listExpressRoutes(routeAll), /all\(\) on \/x\/:id\/thing/);
    });

    test('Express pattern syntax throws instead of producing a wrong path', () => {
        const app = record(() => {
            const server = express();
            server.get('/files/*path', noop);
            return server;
        });
        assert.throws(() => listExpressRoutes(app), /uses Express pattern syntax/);
    });

    test('an array of mount paths throws instead of listing the routes under /', () => {
        const app = record(() => {
            const server = express();
            const router = express.Router();
            router.get('/items', noop);
            server.use(['/a', '/b'], router);
            return server;
        });
        assert.throws(() => listExpressRoutes(app), /use\(\) at \/ with an array of paths \(\/a,\/b\): routes\.js cannot list its routes/);
    });

    test('a mounted Express application throws instead of being dropped', () => {
        const viaApp = record(() => {
            const server = express();
            const sub = express();
            sub.get('/status', noop);
            server.use('/sub', sub);
            return server;
        });
        assert.throws(() => listExpressRoutes(viaApp), /An Express application is mounted at \/sub: routes\.js cannot list its routes; mount an express\.Router\(\) instead/);
        const viaRouter = record(() => {
            const server = express();
            const router = express.Router();
            const sub = express();
            router.use('/inner', sub);
            server.use('/outer', router);
            return server;
        });
        assert.throws(() => listExpressRoutes(viaRouter), /An Express application is mounted at \/outer\/inner/);
    });

    test('a plain handler mounted under a prefix without a router throws', () => {
        const app = record(() => {
            const server = express();
            const serveFiles = (req, res) => res.end();
            server.get('/x', noop);
            server.use('/files', serveFiles);
            return server;
        });
        assert.throws(() => listExpressRoutes(app), /serveFiles is mounted at \/files without a router: it may answer requests that the route parity test cannot see/);
    });

    test('middleware mounted at a router\'s prefix, in the same use() call or another, is the router\'s middleware', () => {
        const app = record(() => {
            const server = express();
            const single = express.Router();
            const other = express.Router();
            single.get('/', noop);
            other.get('/', noop);
            const recordMountPath = () => function recordPath(req, res, next) { next(); };
            server.use((req, res, next) => next());
            server.use('/single/:event_id', recordMountPath(), single);
            server.use('/other', recordMountPath());
            server.use('/other', other);
            return server;
        });
        assert.deepEqual(listExpressRoutes(app), ['GET /other', 'GET /single/{event_id}']);
    });

    test('an app loaded without the recorder throws', () => {
        const server = express();
        server.get('/x', noop);
        assert.throws(() => listExpressRoutes(server), /No routes were recorded/);
    });

    test('restore() puts the original Router methods back', () => {
        const { use, route } = express.Router.prototype;
        instrumentExpress(express)();
        assert.equal(express.Router.prototype.use, use);
        assert.equal(express.Router.prototype.route, route);
    });
});

describe('listOperations', () => {
    const byId = Object.fromEntries(listOperations(spec).map((op) => [op.operationId, op]));

    test('global security means auth required', () => {
        assert.equal(byId.getCourse.auth, 'required');
    });

    test('security: [] means no auth', () => {
        assert.equal(byId.getHealthcheck.auth, 'none');
    });

    test('security: [{}, {...}] means optional auth', () => {
        assert.equal(byId.getMember.auth, 'optional');
    });

    test('lists statuses and path parameters', () => {
        assert.deepEqual(byId.getCourse, {
            method: 'GET',
            template: '/courses/{course_id}',
            operationId: 'getCourse',
            auth: 'required',
            statuses: ['200', '400', '404'],
            pathParams: ['course_id']
        });
    });
});
