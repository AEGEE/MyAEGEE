// Minimal gateway for e2e: serves the built frontend (see support/frontend-routing.ts) and
// proxies /api/<service>/... to the services started by Playwright, the way the
// production gateway does. Services not running in e2e answer with 502.
import http from 'node:http';

import { PORTS, type Service } from './constants.ts';
import { serveStatic, staticFileFor } from './frontend-routing.ts';

const proxied: Service[] = ['core', 'events', 'summeruniversity'];
// With E2E_FRONTEND=react, the migrated paths are served by the React build
// (e2e/.frontend-react-dist) and everything else by the Vue build, like production would.
const react = process.env.E2E_FRONTEND === 'react';

const isProxied = (service: string): service is Service => (proxied as string[]).includes(service);

const proxy = (req: http.IncomingMessage, res: http.ServerResponse, service: Service, upstreamPath: string): void => {
    const upstream = http.request({
        host: 'localhost',
        port: PORTS[service],
        path: upstreamPath,
        method: req.method,
        headers: req.headers
    }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
    });

    upstream.on('error', () => {
        if (res.headersSent) {
            res.destroy();
            return;
        }

        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `${service} is not reachable` }));
    });

    req.pipe(upstream);
};

const serveFrontend = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    serveStatic(staticFileFor(pathname, { react }), res);
};

http.createServer((req, res) => {
    // `/api/events?limit=30` is the events list: the query can follow the service name directly.
    const match = (req.url ?? '/').match(/^\/api\/([a-z-]+)([/?].*)?$/);
    if (!match) {
        serveFrontend(req, res);
        return;
    }

    const [, service, rest] = match;
    if (!isProxied(service)) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `${service} is not part of the e2e stack` }));
        return;
    }

    let upstreamPath = rest || '/';
    if (upstreamPath.startsWith('?')) upstreamPath = `/${upstreamPath}`;
    proxy(req, res, service, upstreamPath);
}).listen(PORTS.gateway, '127.0.0.1');
