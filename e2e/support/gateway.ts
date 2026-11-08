// Minimal gateway for e2e: serves the built frontend from e2e/.frontend-dist and
// proxies /api/<service>/... to the services started by Playwright, the way the
// production gateway does. Services not running in e2e answer with 502.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { PORTS, type Service } from './constants.ts';

const distDir = path.resolve(import.meta.dirname, '../.frontend-dist');
const proxied: Service[] = ['core', 'events', 'summeruniversity'];

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

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

const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
        res.writeHead(400);
        res.end('Bad request');
        return;
    }

    let file = path.join(distDir, path.normalize(pathname));
    if (!file.startsWith(distDir + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // Single page app: unknown paths are handled by the frontend router.
        file = path.join(distDir, 'index.html');
    }

    if (!fs.existsSync(file)) {
        res.writeHead(503);
        res.end('The frontend is not built, run `npm run setup` in e2e/.');
        return;
    }

    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
};

http.createServer((req, res) => {
    const match = (req.url ?? '/').match(/^\/api\/([a-z-]+)(\/.*)?$/);
    if (!match) {
        serveStatic(req, res);
        return;
    }

    const [, service, rest] = match;
    if (!isProxied(service)) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `${service} is not part of the e2e stack` }));
        return;
    }

    proxy(req, res, service, rest || '/');
}).listen(PORTS.gateway, '127.0.0.1');
