// Lists the routes an Express 5 app registers, as "METHOD /openapi/{style}" strings, and
// the operations of a spec, for the route parity test and the table-driven sweeps.
//
// Express 5 (router 2.x) does not keep mount paths on its layers, so instead of reading
// private internals this records Router#use and Router#route calls while the service's
// lib/server.js is loaded. How to use it: docs/testing/backend-openapi.md.

const IGNORED_METHODS = new Set(['head']); // Express answers HEAD from the GET handler
const SPEC_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'trace'];
const KNOWN_METHODS = new Set([...SPEC_METHODS, ...IGNORED_METHODS]);

// Patches express.Router.prototype (the prototype of every router and of app.router).
// Returns a function that restores it. Load lib/server.js between the two calls.
function instrumentExpress(express) {
    const proto = express.Router.prototype;
    const originalUse = proto.use;
    const originalRoute = proto.route;

    proto.use = function use(...args) {
        // Router#use([path], ...handlers): the first argument is a path unless it is a
        // function or a (nested) array that starts with one, as in Express itself.
        let first = args[0];
        while (Array.isArray(first) && first.length) [first] = first;
        const hasPath = typeof first !== 'function';
        const mountPath = hasPath ? args[0] : '/';
        const handlers = args.slice(hasPath ? 1 : 0).flat(Infinity).filter((a) => typeof a === 'function');
        (this.recordedMounts = this.recordedMounts || []).push({ mountPath, handlers });
        return originalUse.apply(this, args);
    };
    proto.route = function route(routePath) {
        const result = originalRoute.call(this, routePath);
        (this.recordedRoutes = this.recordedRoutes || []).push({ routePath, route: result });
        return result;
    };

    return function restore() {
        proto.use = originalUse;
        proto.route = originalRoute;
    };
}

function join(prefix, suffix) {
    const joined = (prefix + '/' + suffix).replace(/\/+/g, '/');
    return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

function toOpenApiPath(expressPath) {
    if (typeof expressPath !== 'string' || /[*?()[\]]|\{|\}/.test(expressPath)) {
        throw new Error(`Route ${String(expressPath)} uses Express pattern syntax; extend toOpenApiPath() in routes.js`);
    }
    return expressPath.replace(/:(\w+)/g, '{$1}');
}

// A sub-application: app.use(path, subApp) mounts a wrapper named mounted_app, and
// router.use(subApp) mounts the application function itself.
function isApplication(handler) {
    return handler.name === 'mounted_app' || (typeof handler.handle === 'function' && typeof handler.set === 'function');
}

function isRouter(handler) {
    return Boolean(handler.recordedRoutes || handler.recordedMounts) || Array.isArray(handler.stack);
}

function collect(router, prefix, out) {
    for (const { routePath, route } of router.recordedRoutes || []) {
        if (typeof routePath !== 'string') {
            throw new Error(`A route under ${prefix || '/'} is registered with ${Array.isArray(routePath) ? 'an array of paths' : 'a regular expression'} `
                + `(${String(routePath)}): routes.js cannot list it; register each path as a string`);
        }
        for (const [method, enabled] of Object.entries(route.methods)) {
            // route.all() sets _all; app.all() enables every method Node knows (acl, bind, ...).
            if (method === '_all' || !KNOWN_METHODS.has(method)) {
                throw new Error(`all() on ${join(prefix, routePath)}: register each method explicitly`);
            }
            if (enabled && !IGNORED_METHODS.has(method)) {
                out.add(`${method.toUpperCase()} ${toOpenApiPath(join(prefix, routePath))}`);
            }
        }
    }
    const mounts = router.recordedMounts || [];
    // Prefixes at which a router is mounted: other handlers there are its middleware
    // (endpointsMetrics.recordMountPath, fetchers), which answer no request themselves.
    const routerPrefixes = new Set(mounts.filter((m) => typeof m.mountPath === 'string' && m.handlers.some(isRouter))
        .map((m) => join('/', m.mountPath)));
    for (const { mountPath, handlers } of mounts) {
        if (typeof mountPath !== 'string') {
            throw new Error(`use() at ${prefix} with ${Array.isArray(mountPath) ? 'an array of paths' : `a ${typeof mountPath} path`} `
                + `(${String(mountPath)}): routes.js cannot list its routes; mount each path with its own use() call`);
        }
        const mountedAt = join(prefix, mountPath);
        for (const handler of handlers) {
            if (isApplication(handler)) {
                throw new Error(`An Express application is mounted at ${mountedAt}: routes.js cannot list its routes; `
                    + 'mount an express.Router() instead');
            }
            if (handler.recordedRoutes || handler.recordedMounts) {
                collect(handler, mountedAt, out);
            } else if (isRouter(handler) && handler.stack.length > 0) {
                throw new Error(`A router mounted at ${mountedAt} was created before instrumentExpress(): load lib/server.js `
                    + 'after instrumentExpress(express)');
            } else if (!isRouter(handler) && join('/', mountPath) !== '/' && !routerPrefixes.has(join('/', mountPath))) {
                throw new Error(`${handler.name || 'An anonymous handler'} is mounted at ${mountedAt} without a router: `
                    + 'it may answer requests that the route parity test cannot see. Register routes on an express.Router(), '
                    + 'or mount the handler in the same place as the router it prepares');
            }
        }
    }
    return out;
}

// app: the express() instance that lib/server.js exports as `server`.
function listExpressRoutes(app) {
    if (!app || !app.router) throw new Error('listExpressRoutes needs an Express 5 app');
    if (!app.router.recordedRoutes && !app.router.recordedMounts) {
        throw new Error('No routes were recorded: load lib/server.js after instrumentExpress(express), '
            + 'with the same express module the service uses');
    }
    return [...collect(app.router, '/', new Set())].sort();
}

function listSpecOperations(spec) {
    const out = [];
    for (const [template, item] of Object.entries(spec.paths || {})) {
        for (const method of SPEC_METHODS) {
            if (item[method]) out.push(`${method.toUpperCase()} ${template}`);
        }
    }
    return out.sort();
}

// Operations with their auth requirement and documented statuses, for the sweeps.
// auth: 'none' (security: []), 'optional' (security: [{}, {...}]) or 'required'.
function listOperations(spec) {
    const globalSecurity = spec.security || [];
    const out = [];
    for (const [template, item] of Object.entries(spec.paths || {})) {
        for (const method of SPEC_METHODS) {
            const op = item[method];
            if (op) {
                const security = op.security || globalSecurity;
                let auth = 'required';
                if (security.length === 0) auth = 'none';
                else if (security.some((s) => Object.keys(s).length === 0)) auth = 'optional';
                out.push({
                    method: method.toUpperCase(),
                    template,
                    operationId: op.operationId,
                    auth,
                    statuses: Object.keys(op.responses || {}),
                    pathParams: (template.match(/\{\w+\}/g) || []).map((p) => p.slice(1, -1))
                });
            }
        }
    }
    return out;
}

module.exports = { instrumentExpress, listExpressRoutes, listSpecOperations, listOperations, toOpenApiPath };
