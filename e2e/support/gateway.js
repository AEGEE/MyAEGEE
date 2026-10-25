// Minimal gateway for e2e: serves the built frontend from e2e/.frontend-dist and
// proxies /api/<service>/... to the services started by Playwright, the way the
// production gateway does. Services not running in e2e answer with 502.
const fs = require('fs');
const http = require('http');
const path = require('path');

const { PORTS } = require('./constants');

const distDir = path.resolve(__dirname, '../.frontend-dist');
const proxied = ['core', 'events', 'summeruniversity'];

const MIME_TYPES = {
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

const proxy = (req, res, service, upstreamPath) => {
    const upstream = http.request({
        host: 'localhost',
        port: PORTS[service],
        path: upstreamPath,
        method: req.method,
        headers: req.headers
    }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
    });

    upstream.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: `${service} is not reachable` }));
    });

    req.pipe(upstream);
};

const serveStatic = (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    let file = path.join(distDir, path.normalize(decodeURIComponent(pathname)));

    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // Single page app: unknown paths are handled by the frontend router.
        file = path.join(distDir, 'index.html');
    }

    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
};

http.createServer((req, res) => {
    const match = req.url.match(/^\/api\/([a-z-]+)(\/.*)?$/);
    if (!match) {
        return serveStatic(req, res);
    }

    const [, service, rest] = match;
    if (!proxied.includes(service)) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: `${service} is not part of the e2e stack` }));
    }

    return proxy(req, res, service, rest || '/');
}).listen(PORTS.gateway);
